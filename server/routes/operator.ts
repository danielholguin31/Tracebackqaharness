import { pushIssue } from '../lib/integrations';
import { Router, Request, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import { openai, sseEvent } from '../lib/openai';
import { executeRun } from '../lib/runner';
import { uid, now, parseJson, WORKSPACE_ID, OWNER_ID } from '../lib/helpers';
import type OpenAI from 'openai';

export const operatorRouter = Router();

// ─── Built-in skills ──────────────────────────────────────
const BUILTIN_SKILLS = [
  { trigger: 'summarize', name: 'Summarize page',    instruction: 'Summarize what\'s currently on this page: overall status, key findings, risks, and recommended next steps.' },
  { trigger: 'diagnose',  name: 'Diagnose failure',  instruction: 'Diagnose the failure visible on this page. Explain what went wrong, the likely root cause, and concrete steps to fix it.' },
  { trigger: 'draft-test',name: 'Draft a test',      instruction: 'Based on what\'s on this page, draft a new test definition including name, goal, steps, and expected outcome.' },
  { trigger: 'write-issue',name: 'Write bug report', instruction: 'Write a structured bug report for the failure on this page: title, severity, reproduction steps, and expected vs actual behavior.' },
];

// ─── Human-readable tool descriptions (for thinking events) ─

const TOOL_THINKING: Record<string, (args: Record<string, unknown>) => string> = {
  list_tests:          (a) => `Searching workspace tests${a.query ? ` for "${a.query}"` : ''}…`,
  list_runs:           (a) => `Fetching recent runs${a.status && a.status !== 'all' ? ` (${a.status})` : ''}…`,
  list_issues:         (a) => `Looking up issues${a.severity && a.severity !== 'all' ? ` (${a.severity})` : ''}…`,
  list_suites:         ()  => 'Fetching test suites…',
  get_run_details:     (a) => `Loading run details for ${a.runId}…`,
  get_issue_details:   (a) => `Loading issue ${a.issueId}…`,
  run_test:            (a) => `Triggering run for "${a.testName || a.testId}"…`,
  create_test_draft:   (a) => `Drafting ${(a.mode as string) ?? 'autonomous'} test "${a.name}"…`,
  create_suite_draft:  (a) => `Drafting suite "${a.name}"…`,
  save_test:           (a) => `Saving test "${a.name}" to library…`,
  save_suite:          (a) => `Saving suite "${a.name}"…`,
  dismiss_issue:       (a) => `Dismissing issue ${a.issueId} (${a.reason})…`,
  push_issue_to_github:(a) => `Pushing issue ${a.issueId} to GitHub…`,
  push_issue_to_linear:(a) => `Pushing issue ${a.issueId} to Linear…`,
  summarize_run:       (a) => `Embedding run summary for ${a.runId}…`,
  slack_send:          (a) => `Sending Slack message to ${a.channel || '#general'}…`,
  slack_get_recent:    ()  => 'Fetching recent Slack messages…',
  show_bar_chart:       (a) => `Rendering bar chart: ${a.title}…`,
  show_metric_grid:     (a) => `Rendering metric grid: ${a.title}…`,
  show_test_matrix:     (a) => `Rendering test matrix: ${a.title}…`,
  show_line_chart:      (a) => `Rendering line chart: ${a.title}…`,
  show_donut_chart:     (a) => `Rendering donut chart: ${a.title}…`,
  show_sparkline:       (a) => `Rendering sparkline: ${a.title}…`,
  show_custom_component:(a) => `Building custom component: ${a.title}…`,
  get_workspace_snapshot: () => 'Scanning workspace for current status…',
  compare_runs: (a) => `Comparing runs ${a.runIdA} and ${a.runIdB}…`,
};

// ─── Operator Tools definition ────────────────────────────

const OPERATOR_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  // ── Read tools ──────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_tests',
      description: 'List test definitions in the workspace. Use this when the user asks about tests or wants to pick one. Returns a workspace_link component for each test found.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional search query to filter by name' },
          mode: { type: 'string', enum: ['autonomous', 'deterministic', 'all'] },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_runs',
      description: 'List recent test runs. Automatically embeds run_summary cards for each result. Use when user asks about recent runs, failures, or history.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['passed', 'failed', 'running', 'all'] },
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_issues',
      description: 'List issues found by test runs. Embeds issue_detail cards for each. Use when user asks about bugs, failures, or open issues.',
      parameters: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critical', 'high', 'warning', 'info', 'all'] },
          status: { type: 'string', enum: ['open', 'resolved', 'dismissed', 'pushed', 'all'] },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_suites',
      description: 'List test suites in the workspace. Returns suite names, test counts, and last run status.',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_run_details',
      description: 'Get full details of a specific run including activity log. Embeds a run_report artifact. Use when user asks about a specific run.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string' },
        },
        required: ['runId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_issue_details',
      description: 'Get full details of a specific issue. Embeds an issue_detail artifact. Use when user asks about a specific issue.',
      parameters: {
        type: 'object',
        properties: {
          issueId: { type: 'string', description: 'The issue ID (e.g. TR-1042)' },
        },
        required: ['issueId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_run',
      description: 'Embed a run_summary card in your response for a specific run. Use to visually highlight a run result inline.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string' },
        },
        required: ['runId'],
        additionalProperties: false,
      },
    },
  },
  // ── Action tools ─────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'run_test',
      description: 'Trigger a test run. Embeds a live run_summary card in chat. Use when user asks to run a specific test.',
      parameters: {
        type: 'object',
        properties: {
          testId: { type: 'string' },
          testName: { type: 'string', description: 'Human-readable name for display' },
          environment: { type: 'string', enum: ['production', 'staging', 'local'] },
        },
        required: ['testId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_test_draft',
      description: `Create a test draft artifact. Opens in the right-panel for user to review and save. Use when user asks to create, write, or draft a new test.
Two modes:
- autonomous: AI navigates freely toward a goal (provide goal and expectedOutcome)
- deterministic: fixed ordered steps the agent executes exactly (provide steps array)
The artifact type "test_draft" will appear as a panel card with all fields editable before saving.`,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Test name, e.g. "Checkout — Payment Confirmation"' },
          mode: { type: 'string', enum: ['autonomous', 'deterministic'] },
          goal: { type: 'string', description: 'For autonomous mode — what this test verifies' },
          entryPoint: { type: 'string', description: 'Starting URL, e.g. https://staging.example.com/checkout' },
          environment: { type: 'string', enum: ['production', 'staging', 'local'] },
          expectedOutcome: { type: 'string', description: 'For autonomous mode — what a successful run looks like' },
          auth: { type: 'string', description: 'Auth context name or email' },
          runnerMode: { type: 'string', enum: ['fast', 'standard', 'deep'] },
          steps: { type: 'array', items: { type: 'string' }, description: 'For deterministic mode — ordered list of action strings' },
          selfHealing: { type: 'boolean', description: 'For deterministic mode — enable self-healing selector recovery' },
          maxSteps: { type: 'number', description: 'For autonomous mode — max navigation steps (default 25)' },
        },
        required: ['name', 'mode'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_suite_draft',
      description: `Create a suite draft artifact. Opens in the right-panel for user to configure and save. Use when user asks to create or draft a new test suite.
The artifact type "suite_draft" will appear as a panel with suite name, selected tests, parallel settings, retry policy, and trigger configuration.
Always call list_tests first to find relevant test IDs to include.`,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Suite name, e.g. "Checkout Regression Suite"' },
          testIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of test IDs to include in the suite',
          },
          testNames: {
            type: 'array',
            items: { type: 'string' },
            description: 'Corresponding test names for display (same order as testIds)',
          },
          testModes: {
            type: 'array',
            items: { type: 'string', enum: ['autonomous', 'deterministic'] },
            description: 'Corresponding test modes (same order as testIds)',
          },
          parallel: { type: 'boolean', description: 'Run tests in parallel (default: true)' },
          maxConcurrency: { type: 'number', description: 'Max parallel tests (default: 4)' },
          retryPolicy: { type: 'string', enum: ['none', 'once', 'up_to_3'], description: 'Retry failed tests policy' },
          triggerOnPr: { type: 'boolean', description: 'Run on pull requests' },
          triggerScheduled: { type: 'boolean', description: 'Run on schedule' },
          triggerCron: { type: 'string', description: 'Cron expression if scheduled, e.g. "0 0 * * *"' },
          triggerWebhook: { type: 'boolean', description: 'Run via webhook' },
        },
        required: ['name'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_test',
      description: 'Save a test draft as a real test definition. Use when user confirms they want to save a draft.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          goal: { type: 'string' },
          entryPoint: { type: 'string' },
          environment: { type: 'string', enum: ['production', 'staging', 'local'] },
          expectedOutcome: { type: 'string' },
          mode: { type: 'string', enum: ['autonomous', 'deterministic'] },
        },
        required: ['name', 'goal', 'entryPoint', 'expectedOutcome'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_suite',
      description: 'Save a suite draft as a real suite. Use when user confirms they want to save a suite draft.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          testIds: { type: 'array', items: { type: 'string' } },
          parallel: { type: 'boolean' },
          maxConcurrency: { type: 'number' },
          retryPolicy: { type: 'string', enum: ['none', 'once', 'up_to_3'] },
          triggerOnPr: { type: 'boolean' },
          triggerScheduled: { type: 'boolean' },
          triggerCron: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'dismiss_issue',
      description: 'Dismiss an issue. Use when user asks to dismiss or close an issue.',
      parameters: {
        type: 'object',
        properties: {
          issueId: { type: 'string' },
          reason: { type: 'string', enum: ['wont_fix', 'not_a_bug', 'duplicate', 'already_known'] },
        },
        required: ['issueId', 'reason'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'push_issue_to_github',
      description: 'Push an issue to GitHub as a new GitHub Issue. Returns a workspace_link with the GitHub URL. Use when user asks to send an issue to GitHub.',
      parameters: {
        type: 'object',
        properties: {
          issueId: { type: 'string', description: 'Traceback issue ID (e.g. TR-1042)' },
        },
        required: ['issueId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'push_issue_to_linear',
      description: 'Push an issue to Linear as a new Linear issue. Returns a workspace_link with the Linear URL. Use when user asks to send an issue to Linear.',
      parameters: {
        type: 'object',
        properties: {
          issueId: { type: 'string', description: 'Traceback issue ID (e.g. TR-1042)' },
          teamId: { type: 'string', description: 'Optional Linear team ID or name' },
          priority: { type: 'string', enum: ['no_priority', 'urgent', 'high', 'medium', 'low'], description: 'Issue priority (default: medium)' },
        },
        required: ['issueId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'slack_send',
      description: 'Send a message or notification to a Slack channel. Use when user asks to notify the team, post a message, or send a Slack update.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Channel name (e.g. #eng-alerts, #general). Default: #general' },
          message: { type: 'string', description: 'The message to send' },
        },
        required: ['message'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'slack_get_recent',
      description: 'Get recent messages from Slack — recent test failure alerts, mentions, or requests sent to the workspace. Use when user asks what\'s happening in Slack or what the team has been asking about.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Channel to fetch from (default: workspace default)' },
          limit: { type: 'number', description: 'Number of messages to return (default: 10)' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_bar_chart',
      description: 'Render a bar chart inline in chat. Use when showing comparisons, run counts per test, issue counts per severity, credits used per test, etc.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          unit: { type: 'string', description: 'Label for values e.g. "runs", "credits", "issues"' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'number' },
                color: { type: 'string', description: 'optional: "accent", "green", "red", "yellow"' },
              },
              required: ['label', 'value'],
            },
          },
        },
        required: ['title', 'data'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_metric_grid',
      description: 'Render a grid of metric cards inline. Use when showing a dashboard summary, workspace stats, or comparing multiple KPIs.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          metrics: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'string' },
                subtext: { type: 'string', description: 'optional context e.g. "this month"' },
                trend: { type: 'string', enum: ['up', 'down', 'flat'], description: 'optional trend direction' },
                trendValue: { type: 'string', description: 'optional e.g. "+12%"' },
              },
              required: ['label', 'value'],
            },
          },
        },
        required: ['title', 'metrics'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_test_matrix',
      description: 'Render a test × environment/run matrix. Use when showing which tests pass/fail across environments or recent runs.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          columns: { type: 'array', items: { type: 'string' }, description: 'Column headers e.g. environments or run dates' },
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                testName: { type: 'string' },
                statuses: {
                  type: 'array',
                  items: { type: 'string', enum: ['passed', 'failed', 'healed', 'skipped', 'pending'] },
                  description: 'One status per column',
                },
              },
              required: ['testName', 'statuses'],
            },
          },
        },
        required: ['title', 'columns', 'rows'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_workspace_snapshot',
      description: "Get a quick snapshot of the current workspace health: open critical/high issues, failing suites, last 5 run statuses, total tests. Use when user asks \"what's broken?\", \"current state\", or \"give me a health check\".",
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_runs',
      description: 'Compare two test runs side-by-side. Shows diff in status, duration, issue count, and key findings. Returns a bar_chart. Use when user asks to compare two runs.',
      parameters: {
        type: 'object',
        properties: {
          runIdA: { type: 'string', description: 'First run ID' },
          runIdB: { type: 'string', description: 'Second run ID' },
        },
        required: ['runIdA', 'runIdB'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_line_chart',
      description: 'Render a line chart with one or more series over time. Great for trends: pass rate over time, credits used per day, issue counts over weeks.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          unit: { type: 'string', description: 'e.g. "%", "credits", "issues"' },
          series: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                color: { type: 'string', enum: ['accent', 'green', 'red', 'yellow'] },
                points: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { x: { type: 'string', description: 'x-axis label e.g. date' }, y: { type: 'number' } },
                    required: ['x', 'y'],
                  },
                },
              },
              required: ['label', 'points'],
            },
          },
        },
        required: ['title', 'series'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_donut_chart',
      description: 'Render a donut/pie chart. Good for breakdowns: issue severity distribution, test modes, suite status split.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          total: { type: 'string', description: 'Optional center label value e.g. "42"' },
          totalLabel: { type: 'string', description: 'Optional center sub-label e.g. "total issues"' },
          slices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'number' },
                color: { type: 'string', description: 'accent, green, red, yellow, purple, orange' },
              },
              required: ['label', 'value'],
            },
          },
        },
        required: ['title', 'slices'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_sparkline',
      description: 'Render a compact sparkline KPI card — single metric with a trend line. Perfect for "pass rate this week", "credits used today", etc.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          value: { type: 'string', description: 'Display value e.g. "94%"' },
          unit: { type: 'string' },
          subtext: { type: 'string', description: 'e.g. "last 7 days"' },
          trend: { type: 'string', enum: ['up', 'down', 'flat'] },
          points: { type: 'array', items: { type: 'number' }, description: 'Raw numeric values for the spark line (8-15 points ideal)' },
          color: { type: 'string', enum: ['accent', 'green', 'red', 'yellow'] },
        },
        required: ['title', 'value', 'points'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_custom_component',
      description: `Render a custom HTML component using only Tailwind CSS and the design system. Use when none of the other chart/card types fit the visualization you need. Build tables, timelines, status boards, diff views, or any bespoke layout. Rules: only use Tailwind utility classes, design-system CSS variables (bg-muted, text-foreground, text-accent, border-border, bg-accent, text-muted-foreground, bg-primary, text-primary-foreground), and inline SVG. No external libraries. Keep it self-contained.`,
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Card header label' },
          html: { type: 'string', description: 'Self-contained HTML with Tailwind classes. Must render correctly when placed inside a padded white card.' },
        },
        required: ['title', 'html'],
        additionalProperties: false,
      },
    },
  },
];

// ─── Sanitize tool results (truncate long strings before sending back to model) ──

function sanitizeToolResult(obj: unknown, maxLen = 400): unknown {
  if (typeof obj === 'string') return obj.length > maxLen ? obj.slice(0, maxLen) + ' …[truncated]' : obj;
  if (Array.isArray(obj)) return obj.map(item => sanitizeToolResult(item, maxLen));
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, sanitizeToolResult(v, maxLen)])
    );
  }
  return obj;
}

// ─── Tool executor ────────────────────────────────────────

type InlineComponent =
  | { type: 'run_summary';    data: Record<string, unknown> }
  | { type: 'test_draft';     data: Record<string, unknown> }
  | { type: 'suite_draft';    data: Record<string, unknown> }
  | { type: 'run_report';     data: Record<string, unknown> }
  | { type: 'issue_detail';   data: Record<string, unknown> }
  | { type: 'test_detail';    data: Record<string, unknown> }
  | { type: 'workspace_link'; data: Record<string, unknown> }
  | { type: 'approval';       data: Record<string, unknown> }
  | { type: 'bar_chart';    data: Record<string, unknown> }
  | { type: 'metric_grid';  data: Record<string, unknown> }
  | { type: 'test_matrix';  data: Record<string, unknown> }
  | { type: 'line_chart' | 'donut_chart' | 'sparkline' | 'custom_component'; data: Record<string, unknown> };

interface ToolResult {
  result: unknown;
  component?: InlineComponent;
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {

    case 'list_tests': {
      const rows = await db.select().from(schema.tests).where(eq(schema.tests.archived, false));
      const filtered = rows.filter(t => {
        if (args.query && !t.name.toLowerCase().includes((args.query as string).toLowerCase())) return false;
        if (args.mode && args.mode !== 'all' && t.mode !== args.mode) return false;
        return true;
      }).slice(0, 20);
      const tests = filtered.map(t => ({ id: t.id, name: t.name, mode: t.mode, status: t.status, environment: t.environment }));
      // Emit workspace_link components for each test
      return { result: tests };
    }

    case 'list_runs': {
      const rows = await db.select().from(schema.runs).orderBy(desc(schema.runs.startedAt)).limit(Number(args.limit) || 10);
      const filtered = (args.status && args.status !== 'all') ? rows.filter(r => r.status === args.status) : rows;
      return {
        result: filtered.map(r => ({ id: r.id, testName: r.testName, mode: r.mode, status: r.status, environment: r.environment, duration: r.duration, startedAt: r.startedAt, keyFinding: r.keyFinding })),
      };
    }

    case 'list_issues': {
      const rows = await db.select().from(schema.issues).orderBy(desc(schema.issues.createdAt));
      const filtered = rows.filter(i => {
        if (args.severity && args.severity !== 'all' && i.severity !== args.severity) return false;
        if (args.status && args.status !== 'all' && i.status !== args.status) return false;
        return true;
      });
      return { result: filtered.map(i => ({ id: i.id, title: i.title, severity: i.severity, status: i.status, flow: i.flow, createdAt: i.createdAt })) };
    }

    case 'list_suites': {
      const rows = await db.select().from(schema.suites).where(eq(schema.suites.workspaceId, WORKSPACE_ID));
      return { result: rows.map(s => ({ id: s.id, name: s.name, status: s.status, lastRunAt: s.lastRunAt, testCount: parseJson<string[]>(s.testIdsJson, []).length })) };
    }

    case 'get_run_details': {
      const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, args.runId as string));
      if (!run) return { result: { error: `Run ${args.runId} not found` } };
      const logs = await db.select().from(schema.activityLogs)
        .where(eq(schema.activityLogs.runId, run.id))
        .orderBy(schema.activityLogs.step);
      return {
        result: { ...run, activityLog: logs },
        component: {
          type: 'run_report',
          data: {
            runId: run.id, testName: run.testName, status: run.status,
            duration: run.duration ? `${run.duration}s` : 'N/A',
            environment: run.environment, branch: run.branch ?? '',
            keyFinding: run.keyFinding ?? '', screenshotCount: run.screenshotCount,
            issueCount: run.issueCount, href: `/runs/${run.id}`,
            steps: logs.slice(0, 8).map(l => ({ step: l.step, thought: l.thought, action: l.action, isError: l.isError })),
          },
        },
      };
    }

    case 'get_issue_details': {
      const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, args.issueId as string));
      if (!issue) return { result: { error: `Issue ${args.issueId} not found` } };
      return {
        result: issue,
        component: {
          type: 'issue_detail',
          data: {
            issueId: issue.id, title: issue.title, severity: issue.severity,
            status: issue.status, flow: issue.flow, context: issue.context,
            evidence: issue.evidence, proposedSolution: issue.proposedSolution ?? '',
            testName: issue.testId, runId: issue.runId, href: `/issues/${issue.id}`,
          },
        },
      };
    }

    case 'run_test': {
      const [test] = await db.select().from(schema.tests).where(eq(schema.tests.id, args.testId as string));
      const testName = (args.testName as string) || test?.name || 'Unknown test';
      const env = (args.environment as string) || 'staging';
      const runId = uid();
      await db.insert(schema.runs).values({
        id: runId, workspaceId: WORKSPACE_ID, testId: args.testId as string,
        testName, mode: test?.mode ?? 'autonomous', status: 'queued',
        environment: env, viewport: 'desktop', runnerMode: 'standard',
        triggeredBy: 'operator', triggeredByUser: OWNER_ID,
        startedAt: now(), screenshotCount: 0, issueCount: 0,
      });
      executeRun(runId);
      return {
        result: { runId, testName, status: 'queued', environment: env },
        component: {
          type: 'run_summary',
          data: { runId, flow: testName, result: 'Running', finding: 'Run started — check back shortly for results', time: now(), env, href: `/runs/${runId}` },
        },
      };
    }

    case 'create_test_draft': {
      const mode = ((args.mode as string) ?? 'autonomous').toLowerCase();
      const componentData: Record<string, unknown> = {
        name: args.name,
        project: 'Traceback (Production)',
        environment: (args.environment as string) ?? 'staging',
        entryPoint: (args.entryPoint as string) ?? '',
        auth: (args.auth as string) ?? 'test-user@example.com',
        mode,
      };
      if (mode === 'deterministic') {
        componentData.steps = (args.steps as string[]) ?? [];
        componentData.selfHealing = (args.selfHealing as boolean) ?? true;
      } else {
        componentData.goal = (args.goal as string) ?? '';
        componentData.expectedOutcome = (args.expectedOutcome as string) ?? '';
        componentData.runnerMode = (args.runnerMode as string) ?? 'standard';
        if (args.maxSteps) componentData.maxSteps = args.maxSteps;
      }
      return {
        result: { drafted: true, name: args.name, mode },
        component: { type: 'test_draft', data: componentData },
      };
    }

    case 'create_suite_draft': {
      const testIds = (args.testIds as string[]) ?? [];
      const testNames = (args.testNames as string[]) ?? [];
      const testModes = (args.testModes as string[]) ?? [];
      const tests = testIds.map((id, i) => ({
        id,
        name: testNames[i] ?? id,
        mode: (testModes[i] ?? 'autonomous') as 'autonomous' | 'deterministic',
      }));
      return {
        result: { drafted: true, name: args.name },
        component: {
          type: 'suite_draft',
          data: {
            name: args.name,
            tests,
            parallel: (args.parallel as boolean) ?? true,
            maxConcurrency: (args.maxConcurrency as number) ?? 4,
            retryPolicy: (args.retryPolicy as string) ?? 'none',
            triggerOnPr: (args.triggerOnPr as boolean) ?? false,
            triggerScheduled: (args.triggerScheduled as boolean) ?? false,
            triggerCron: (args.triggerCron as string) ?? '0 0 * * *',
            triggerWebhook: (args.triggerWebhook as boolean) ?? false,
          },
        },
      };
    }

    case 'save_test': {
      const testId = uid();
      await db.insert(schema.tests).values({
        id: testId, workspaceId: WORKSPACE_ID,
        name: args.name as string,
        mode: (args.mode as string)?.toLowerCase() === 'deterministic' ? 'deterministic' : 'autonomous',
        status: 'never_run',
        environment: (args.environment as string) ?? 'staging',
        entryPoint: args.entryPoint as string,
        auth: 'test-user@example.com',
        runnerMode: 'standard',
        viewportJson: JSON.stringify({ mode: 'single', single: 'desktop' }),
        triggersJson: JSON.stringify({ onPr: false, onDeploy: false, scheduled: false }),
        suiteIdsJson: '[]', defaultReportsJson: '["standard"]',
        tagsJson: '[]', createdAt: now(), version: 1, archived: false,
        selfHealing: false, screenshotOnFailure: true, selfHealingSensitivity: 'medium',
      });
      return {
        result: { testId, name: args.name, saved: true },
        component: {
          type: 'workspace_link',
          data: { objectType: 'Test', title: args.name, href: `/tests/${testId}` },
        },
      };
    }

    case 'save_suite': {
      const suiteId = uid();
      const retryMap: Record<string, string> = { none: 'none', once: 'once', up_to_3: 'twice' };
      await db.insert(schema.suites).values({
        id: suiteId, workspaceId: WORKSPACE_ID,
        name: args.name as string,
        testIdsJson: JSON.stringify((args.testIds as string[]) ?? []),
        triggersJson: JSON.stringify({
          onPr: (args.triggerOnPr as boolean) ?? false,
          onDeploy: false,
          scheduled: (args.triggerScheduled as boolean) ?? false,
          cronExpression: (args.triggerCron as string) ?? '0 0 * * *',
        }),
        parallel: (args.parallel as boolean) ?? true,
        maxConcurrency: (args.maxConcurrency as number) ?? 4,
        retryFailedTests: retryMap[(args.retryPolicy as string) ?? 'none'] ?? 'none',
        status: 'never_run',
        createdAt: now(),
      });
      return {
        result: { suiteId, name: args.name, saved: true },
        component: {
          type: 'workspace_link',
          data: { objectType: 'Suite', title: args.name, href: `/suites/${suiteId}` },
        },
      };
    }

    case 'dismiss_issue': {
      await db.update(schema.issues).set({
        status: 'dismissed',
        dismissReason: args.reason as string,
      }).where(eq(schema.issues.id, args.issueId as string));
      return { result: { dismissed: true, issueId: args.issueId, reason: args.reason } };
    }

    case 'push_issue_to_github':
    case 'push_issue_to_linear': {
      try {
        const reference = await pushIssue(String(args.issueId), name.endsWith('github') ? 'github' : 'linear');
        return { result: { pushed: true, ...reference }, component: { type: 'workspace_link', data: { objectType: 'Issue', title: reference.id, href: reference.url } } };
      } catch (error) { return { result: { error: String(error), pushed: false } }; }
    }

    case 'summarize_run': {
      const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, args.runId as string));
      if (!run) return { result: { error: 'Run not found' } };
      return {
        result: { id: run.id, testName: run.testName, status: run.status },
        component: {
          type: 'run_summary',
          data: { runId: run.id, flow: run.testName, result: run.status, finding: run.keyFinding ?? '', time: run.startedAt, env: run.environment, href: `/runs/${run.id}` },
        },
      };
    }

    case 'slack_send':
    case 'slack_get_recent':
      return { result: { error: 'Slack integration is not connected. No message was sent or fetched.' } };

    case 'show_bar_chart':
      return {
        result: { rendered: true },
        component: { type: 'bar_chart', data: { title: args.title, unit: args.unit, data: args.data } },
      };

    case 'show_metric_grid':
      return {
        result: { rendered: true },
        component: { type: 'metric_grid', data: { title: args.title, metrics: args.metrics } },
      };

    case 'show_test_matrix':
      return {
        result: { rendered: true },
        component: { type: 'test_matrix', data: { title: args.title, columns: args.columns, rows: args.rows } },
      };

    case 'show_line_chart':
      return {
        result: { rendered: true },
        component: { type: 'line_chart', data: { title: args.title, unit: args.unit, series: args.series } },
      };

    case 'show_donut_chart':
      return {
        result: { rendered: true },
        component: { type: 'donut_chart', data: { title: args.title, total: args.total, totalLabel: args.totalLabel, slices: args.slices } },
      };

    case 'show_sparkline':
      return {
        result: { rendered: true },
        component: { type: 'sparkline', data: { title: args.title, value: args.value as string, unit: args.unit, subtext: args.subtext, trend: args.trend, points: args.points as number[], color: args.color } },
      };

    case 'show_custom_component':
      return {
        result: { rendered: true },
        component: { type: 'custom_component', data: { title: args.title as string, html: args.html as string } },
      };

    case 'get_workspace_snapshot': {
      const [allIssues, recentRuns, allTests, allSuites] = await Promise.all([
        db.select().from(schema.issues).where(eq(schema.issues.workspaceId, WORKSPACE_ID)),
        db.select().from(schema.runs).orderBy(desc(schema.runs.startedAt)).limit(5),
        db.select().from(schema.tests),
        db.select().from(schema.suites).where(eq(schema.suites.workspaceId, WORKSPACE_ID)),
      ]);
      const openCritical = allIssues.filter(i => i.status === 'open' && i.severity === 'critical').length;
      const openHigh = allIssues.filter(i => i.status === 'open' && i.severity === 'high').length;
      const failingSuites = allSuites.filter(s => s.status === 'failing' || s.status === 'failed').length;
      const totalOpen = allIssues.filter(i => i.status === 'open').length;
      const passRate = recentRuns.length
        ? Math.round(recentRuns.filter(r => r.status === 'passed' || r.status === 'healed').length / recentRuns.length * 100)
        : null;
      return {
        result: { openCritical, openHigh, failingSuites, totalTests: allTests.length },
        component: {
          type: 'metric_grid',
          data: {
            title: 'Workspace Snapshot',
            metrics: [
              { label: 'Critical Issues', value: String(openCritical), trend: openCritical > 0 ? 'down' : 'flat', trendValue: openCritical > 0 ? 'needs attention' : 'all clear' },
              { label: 'High Issues', value: String(openHigh), trend: openHigh > 0 ? 'down' : 'flat' },
              { label: 'Total Open Issues', value: String(totalOpen) },
              { label: 'Total Tests', value: String(allTests.length) },
              { label: 'Failing Suites', value: String(failingSuites), trend: failingSuites > 0 ? 'down' : 'flat' },
              ...(passRate !== null ? [{ label: 'Pass Rate (last 5)', value: `${passRate}%`, trend: passRate >= 80 ? 'up' as const : 'down' as const, subtext: `${recentRuns.length} recent runs` }] : []),
            ],
          },
        },
      };
    }

    case 'compare_runs': {
      const [runA, runB] = await Promise.all([
        db.select().from(schema.runs).where(eq(schema.runs.id, args.runIdA as string)).then(r => r[0]),
        db.select().from(schema.runs).where(eq(schema.runs.id, args.runIdB as string)).then(r => r[0]),
      ]);
      if (!runA) return { result: { error: `Run ${args.runIdA} not found` } };
      if (!runB) return { result: { error: `Run ${args.runIdB} not found` } };
      const aLabel = (runA.testName ?? runA.id).slice(0, 20);
      const bLabel = (runB.testName ?? runB.id).slice(0, 20);
      const durationA = Math.round(runA.duration ?? 0);
      const durationB = Math.round(runB.duration ?? 0);
      return {
        result: { runA: { id: runA.id, status: runA.status, duration: runA.duration, issueCount: runA.issueCount }, runB: { id: runB.id, status: runB.status, duration: runB.duration, issueCount: runB.issueCount } },
        component: {
          type: 'bar_chart',
          data: {
            title: `Run Comparison`,
            unit: '',
            data: [
              { label: `${aLabel} — Issues`, value: runA.issueCount ?? 0, color: (runA.issueCount ?? 0) > (runB.issueCount ?? 0) ? 'red' : 'green' },
              { label: `${bLabel} — Issues`, value: runB.issueCount ?? 0, color: (runB.issueCount ?? 0) > (runA.issueCount ?? 0) ? 'red' : 'green' },
              { label: `${aLabel} — Duration (s)`, value: durationA, color: durationA > durationB ? 'yellow' : 'green' },
              { label: `${bLabel} — Duration (s)`, value: durationB, color: durationB > durationA ? 'yellow' : 'green' },
              { label: `${aLabel} — Screenshots`, value: runA.screenshotCount ?? 0, color: 'accent' },
              { label: `${bLabel} — Screenshots`, value: runB.screenshotCount ?? 0, color: 'accent' },
            ],
          },
        },
      };
    }

    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}

// ─── System prompt ────────────────────────────────────────

function buildSystemPrompt(settings: typeof schema.operatorSettings.$inferSelect): string {
  return `You are Traceback Operator — the AI engine powering the Traceback automated testing platform. You are a deep expert in software quality, test automation, CI/CD pipelines, and failure analysis. You have full access to this workspace's live data and can take real actions.

**Scope:** You are focused on this Traceback workspace — tests, runs, issues, suites, integrations, platform usage, and anything related to the team's quality and testing work. You can answer questions about how Traceback works, explain platform concepts, and help users navigate the product. If someone asks something completely unrelated to software testing or this platform (e.g. write me a recipe, explain quantum physics), decline briefly and redirect: "That's outside my scope — I'm here for your testing workflow."

## Current page context
When a "Current page context" system message appears in the conversation, it contains exactly what the user is looking at right now — the specific page, entity, data, counts, and state visible to them. Use it directly and naturally. If they ask "what is this?", "what am I looking at?", "what's here?", or anything about their current view — answer using that context. Never say it's outside your scope. Do not quote or reference the system message itself — just use the information it contains.

## What you can do

**Read data (use freely, no confirmation needed):**
- list_tests — find tests by name or mode
- list_runs — recent run history with status
- list_issues — open/closed bugs and failures
- list_suites — test suites in the workspace
- get_run_details — full run activity log → embeds a run_report artifact
- get_issue_details — full issue details → embeds an issue_detail artifact
- summarize_run — embed a run_summary card inline
- get_workspace_snapshot — workspace health digest (open issues by severity, failing suites, recent run pass rate) → metric_grid
- compare_runs(runIdA, runIdB) — side-by-side run diff → bar_chart

**Create drafts (opens an editable right-panel artifact):**
- create_test_draft → opens a "test_draft" artifact panel the user can review, edit, and save
  **Important:** Always ask or infer whether the user wants an **autonomous** test (AI navigates freely toward a goal) or a **deterministic** test (fixed ordered steps). Pass mode: "autonomous" or mode: "deterministic" accordingly. For deterministic, build a meaningful steps array. For autonomous, write a detailed goal and expectedOutcome.
- create_suite_draft → opens a "suite_draft" artifact panel with all suite settings
  Always call list_tests first to find relevant test IDs before building a suite.

**Take actions:**
- run_test → triggers a live test run, embeds a run_summary card
- save_test / save_suite → persists drafts to the workspace
- dismiss_issue → marks an issue dismissed with a reason
- push_issue_to_github → creates a real GitHub issue and returns a link
- push_issue_to_linear → creates a Linear issue with priority and returns a link
- slack_send → sends a message to a Slack channel
- slack_get_recent → reads recent messages from a channel

## Visualizations — use these generously
Always prefer showing data visually over describing it in text. Pick the right viz for the job:

**Charts:**
- show_bar_chart → horizontal bar chart, great for comparisons (use color: red/green/yellow/accent)
- show_line_chart → line/area chart with one or more series, great for trends over time
- show_donut_chart → donut chart, great for breakdowns and distributions (issue severity split, test mode mix)
- show_sparkline → compact KPI card with a sparkline, great for single metrics ("94% pass rate this week")
- show_metric_grid → grid of KPI cards with trend indicators, great for dashboards

**Other:**
- show_test_matrix → test × environment/run status dot grid
- show_custom_component → fully custom HTML/Tailwind component when no other type fits. Use this for tables, timelines, status boards, diff views — anything bespoke. Only Tailwind + design system CSS vars allowed.

If the user asks about trends, distribution, or comparisons — reach for a chart. Don't just list numbers in text when a sparkline or bar chart would say it better.

## Reasoning approach
Think carefully before acting. For complex requests:
1. Understand what the user actually needs (not just what they literally asked)
2. Decide which tools to call and in what order — fetch context before creating things
3. Think about edge cases (test doesn't exist, issue already pushed, no runs yet)
4. Act, then give a clear summary of what you did and any next steps worth considering

For simple lookups or questions, answer directly without unnecessary tool calls. Don't overthink it.

## Integrations
- **GitHub** — push issues as GitHub Issues
- **Linear** — push issues as Linear tickets with priority
- **Slack** — send notifications and read recent channel activity

## Communication style
- Expert and precise. No filler, no hedging. Say what you know.
- Lead with the finding or action — not a restatement of the question
- Use **bold** for key data points, bullets for lists, code blocks for selectors/payloads/errors
- Let visual cards carry the data — keep prose to the essential interpretation
- When something is ambiguous, state your assumption and proceed rather than asking
- If a test is passing, say so plainly. If something is broken, name the root cause directly.

## CRITICAL: Output format rules
- Never emit raw HTML tags in your text responses. No div, span, table, or any HTML elements. Text responses must be pure Markdown only.
- Never generate base64 images or data: URLs. Do not attempt to render visualizations as images.
- For visual data — always use the provided tool calls (show_bar_chart, show_test_matrix, show_custom_component, etc.). Never try to approximate them with HTML or ASCII art in prose.
- If you want to show a table, use Markdown table syntax (pipe-separated columns), not HTML.
${settings.instructions ? `\n## Workspace guidance\n${settings.instructions}` : ''}
${settings.alwaysDo ? `\nAlways: ${settings.alwaysDo}` : ''}
${settings.neverDo ? `\nNever: ${settings.neverDo}` : ''}
${(() => {
  const modes: Record<string, string> = {
    supervised: '\n## Autonomy: Supervised\nBefore using any tool that creates or modifies data, describe what you\'re about to do and ask "Want me to go ahead?" Wait for the user to confirm before proceeding.',
    balanced:   '\n## Autonomy: Balanced\nUse read tools freely. Ask for a quick confirmation only before: run_test, save_test, save_suite, push_issue_to_github, push_issue_to_linear, slack_send.',
    autonomous: '\n## Autonomy: Autonomous\nJust do it. Use all tools without asking for confirmation. Tell the user what you did afterward.',
    plan:       '\n## Autonomy: Plan mode\nBefore taking any action, write out your full numbered plan — every step you\'ll take. Then ask "Ready for me to run this?" Wait for explicit confirmation before executing anything.',
  };
  return modes[settings.autonomyPreset] ?? modes.balanced;
})()}`;
}

// ─── Helper: accumulate streaming tool calls ──────────────

interface PendingToolCall {
  index: number;
  id: string;
  name: string;
  args: string;
}

// ─── Routes ───────────────────────────────────────────────

// ── Skills ────────────────────────────────────────────────
operatorRouter.get('/skills', async (_req, res) => {
  try {
    const skills = await db.select().from(schema.operatorSkills)
      .where(eq(schema.operatorSkills.workspaceId, WORKSPACE_ID))
      .orderBy(schema.operatorSkills.createdAt);

    // Seed built-ins if empty
    if (skills.length === 0) {
      const ts = now();
      await db.insert(schema.operatorSkills).values(
        BUILTIN_SKILLS.map(s => ({
          id: uid(), workspaceId: WORKSPACE_ID,
          name: s.name, trigger: s.trigger, instruction: s.instruction,
          isBuiltin: true, createdAt: ts,
        }))
      );
      const seeded = await db.select().from(schema.operatorSkills)
        .where(eq(schema.operatorSkills.workspaceId, WORKSPACE_ID))
        .orderBy(schema.operatorSkills.createdAt);
      return res.json(seeded);
    }

    return res.json(skills);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

operatorRouter.post('/skills', async (req, res) => {
  try {
    const { name, trigger, instruction } = req.body as { name: string; trigger: string; instruction: string };
    if (!name || !trigger || !instruction) return res.status(400).json({ error: 'name, trigger, instruction required' });
    const id = uid();
    await db.insert(schema.operatorSkills).values({
      id, workspaceId: WORKSPACE_ID,
      name, trigger: trigger.replace(/^\//, ''), instruction,
      isBuiltin: false, createdAt: now(),
    });
    return res.status(201).json({ id, name, trigger, instruction, isBuiltin: false });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

operatorRouter.delete('/skills/:id', async (req, res) => {
  try {
    const [skill] = await db.select().from(schema.operatorSkills)
      .where(eq(schema.operatorSkills.id, String(req.params.id)));
    if (!skill) return res.status(404).json({ error: 'Not found' });
    if (skill.isBuiltin) return res.status(403).json({ error: 'Cannot delete built-in skills' });
    await db.delete(schema.operatorSkills).where(eq(schema.operatorSkills.id, String(req.params.id)));
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

operatorRouter.get('/sessions', async (_req, res) => {
  try {
    const sessions = await db.select().from(schema.operatorSessions)
      .where(eq(schema.operatorSessions.workspaceId, WORKSPACE_ID))
      .orderBy(desc(schema.operatorSessions.updatedAt));

    const withCounts = await Promise.all(
      sessions.map(async s => {
        const msgs = await db.select({ id: schema.operatorMessages.id })
          .from(schema.operatorMessages)
          .where(eq(schema.operatorMessages.sessionId, s.id));
        return { ...s, messageCount: msgs.length };
      })
    );
    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

operatorRouter.post('/sessions', async (req, res) => {
  const { title, pageLabel } = req.body as { title?: string; pageLabel?: string };
  const id = uid();
  const ts = now();
  await db.insert(schema.operatorSessions).values({
    id, workspaceId: WORKSPACE_ID,
    title: title ?? 'New Chat',
    participantsJson: JSON.stringify([OWNER_ID]),
    pageLabel: pageLabel ?? null,
    createdAt: ts, updatedAt: ts,
  });
  res.status(201).json({ id, title: title ?? 'New Chat', pageLabel: pageLabel ?? null, createdAt: ts, updatedAt: ts });
});

operatorRouter.post('/sessions/:id/title', async (req, res) => {
  try {
    const { message } = req.body as { message: string };
    let title = message.trim().split(/\s+/).slice(0, 4).join(' ');
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.3,
        max_tokens: 12,
        messages: [
          { role: 'system', content: 'Generate a short 2-4 word title that captures the semantic intent of this chat message. No punctuation, no quotes, title case.' },
          { role: 'user', content: message },
        ],
      });
      const generated = completion.choices[0]?.message?.content?.trim();
      if (generated) title = generated;
    } catch { /* use fallback */ }
    await db.update(schema.operatorSessions)
      .set({ title, updatedAt: now() })
      .where(eq(schema.operatorSessions.id, String(req.params.id)));
    res.json({ title });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

operatorRouter.get('/sessions/:id', async (req, res) => {
  const [session] = await db.select().from(schema.operatorSessions)
    .where(eq(schema.operatorSessions.id, String(req.params.id)));
  if (!session) return res.status(404).json({ error: 'Not found' });
  const messages = await db.select().from(schema.operatorMessages)
    .where(eq(schema.operatorMessages.sessionId, String(req.params.id)))
    .orderBy(schema.operatorMessages.createdAt);
  return res.json({ ...session, messages: messages.map(m => ({ ...m, components: parseJson(m.componentsJson, []), reasoning: parseJson(m.reasoningJson, []) })) });
});

operatorRouter.get('/sessions/:id/messages', async (req, res) => {
  const messages = await db.select().from(schema.operatorMessages)
    .where(eq(schema.operatorMessages.sessionId, String(req.params.id)))
    .orderBy(schema.operatorMessages.createdAt);
  res.json(messages.map(m => ({ ...m, components: parseJson(m.componentsJson, []), reasoning: parseJson(m.reasoningJson, []) })));
});

operatorRouter.post('/sessions/:id/participants', async (req, res) => {
  const [session] = await db.select().from(schema.operatorSessions)
    .where(eq(schema.operatorSessions.id, String(req.params.id)));
  if (!session) return res.status(404).json({ error: 'Not found' });
  const participants = parseJson<string[]>(session.participantsJson, []);
  if (!participants.includes(req.body.userId)) participants.push(req.body.userId);
  await db.update(schema.operatorSessions).set({ participantsJson: JSON.stringify(participants) })
    .where(eq(schema.operatorSessions.id, String(req.params.id)));
  return res.json({ ok: true });
});

operatorRouter.get('/settings', async (_req, res) => {
  let [settings] = await db.select().from(schema.operatorSettings)
    .where(eq(schema.operatorSettings.workspaceId, WORKSPACE_ID));
  if (!settings) {
    await db.insert(schema.operatorSettings).values({
      id: uid(), workspaceId: WORKSPACE_ID,
      autonomyPreset: 'balanced', responseFormat: 50, mockupFreq: 50,
      responseLength: 50, model: 'o3-mini', instructions: '', alwaysDo: '', neverDo: '',
    });
    [settings] = await db.select().from(schema.operatorSettings)
      .where(eq(schema.operatorSettings.workspaceId, WORKSPACE_ID));
  }
  res.json(settings);
});

operatorRouter.patch('/settings', async (req, res) => {
  const { autonomyPreset, responseFormat, mockupFreq, responseLength, model, instructions, alwaysDo, neverDo } = req.body;
  await db.update(schema.operatorSettings).set({
    ...(autonomyPreset !== undefined && { autonomyPreset }),
    ...(responseFormat !== undefined && { responseFormat }),
    ...(mockupFreq !== undefined && { mockupFreq }),
    ...(responseLength !== undefined && { responseLength }),
    ...(model !== undefined && { model }),
    ...(instructions !== undefined && { instructions }),
    ...(alwaysDo !== undefined && { alwaysDo }),
    ...(neverDo !== undefined && { neverDo }),
  }).where(eq(schema.operatorSettings.workspaceId, WORKSPACE_ID));
  res.json({ ok: true });
});

// POST /api/operator/sessions/:id/messages  ← SSE streaming
operatorRouter.post('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId);
  const { content, pageContext, pageContexts, autonomyPreset: overrideAutonomy, model: overrideModel } = req.body as { content: string; pageContext?: string; pageContexts?: string[]; action?: string; autonomyPreset?: string; model?: string };
  // Merge pageContexts array + legacy pageContext into a unified array
  const allPageContexts = [...(pageContexts ?? []), ...(pageContext ? [pageContext] : [])];

  const [session] = await db.select().from(schema.operatorSessions)
    .where(eq(schema.operatorSessions.id, sessionId));
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  const userMsgId = uid();
  const ts = now();
  // Store only clean user content — pageContext is never persisted
  await db.insert(schema.operatorMessages).values({
    id: userMsgId, sessionId, role: 'user', content,
    fromUserId: OWNER_ID, createdAt: ts,
  });
  await db.update(schema.operatorSessions).set({ updatedAt: ts })
    .where(eq(schema.operatorSessions.id, sessionId));

  let [settings] = await db.select().from(schema.operatorSettings)
    .where(eq(schema.operatorSettings.workspaceId, WORKSPACE_ID));
  if (!settings) {
    settings = {
      id: uid(), workspaceId: WORKSPACE_ID, autonomyPreset: 'balanced',
      responseFormat: 50, mockupFreq: 50, responseLength: 50,
      model: 'o3-mini', instructions: '', alwaysDo: '', neverDo: '',
    };
  }

  const historyRows = await db.select().from(schema.operatorMessages)
    .where(eq(schema.operatorMessages.sessionId, sessionId))
    .orderBy(schema.operatorMessages.createdAt);

  // Build history excluding the message we just inserted (last row) — we'll add it back with context
  const allHistory = historyRows.slice(-20).map(m => ({
    role: (m.role === 'operator' ? 'assistant' : m.role) as 'user' | 'assistant',
    content: m.content,
  }));
  const historyWithoutLast = allHistory.slice(0, -1);

  const oaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt({ ...settings, autonomyPreset: overrideAutonomy || settings.autonomyPreset }) },
    ...historyWithoutLast,
    // Inject page contexts as system messages right before the current user turn — never stored in DB
    ...allPageContexts.map(ctx => ({ role: 'system' as const, content: `## Current page context\n${ctx}` })),
    { role: 'user' as const, content },
  ];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let fullContent = '';
  const collectedComponents: InlineComponent[] = [];
  const reasoningSteps: string[] = [];

  // Use o3-mini (thinking model) — no temperature, uses max_completion_tokens
  const modelName = overrideModel || settings.model || 'o3-mini';
  const isThinkingModel = modelName.startsWith('o1') || modelName.startsWith('o3');

  try {
    let continueLoop = true;

    while (continueLoop) {
      const callParams: any = {
        model: modelName,
        messages: oaiMessages,
        tools: OPERATOR_TOOLS,
        tool_choice: 'auto',
        stream: true,
        max_completion_tokens: 4000,
      };

      // o-series models don't support temperature
      if (!isThinkingModel) {
        callParams.temperature = 0.4;
        callParams.max_tokens = 1200;
        delete callParams.max_completion_tokens;
      }

      const stream = await openai.chat.completions.create({ ...callParams, stream: true } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming);

      let currentText = '';
      const pendingToolCalls: PendingToolCall[] = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          currentText += delta.content;
          fullContent += delta.content;
          sseEvent(res, 'token', { content: delta.content });
          if (typeof (res as any).flush === 'function') (res as any).flush();
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!pendingToolCalls[idx]) {
              pendingToolCalls[idx] = { index: idx, id: tc.id ?? '', name: tc.function?.name ?? '', args: '' };
            }
            if (tc.id) pendingToolCalls[idx].id = tc.id;
            if (tc.function?.name) pendingToolCalls[idx].name = tc.function.name;
            if (tc.function?.arguments) pendingToolCalls[idx].args += tc.function.arguments;
          }
        }

        const finishReason = chunk.choices[0]?.finish_reason;

        if (finishReason === 'stop') {
          continueLoop = false;
        }

        if (finishReason === 'tool_calls') {
          // Tell the client to discard any intermediate text streamed so far —
          // only the final response (after all tools complete) should be shown.
          sseEvent(res, 'reset', {});
          fullContent = ''; // reset server-side accumulator too; final text will re-fill it

          oaiMessages.push({
            role: 'assistant',
            content: currentText || null,
            tool_calls: pendingToolCalls.filter(Boolean).map(tc => ({
              id: tc.id, type: 'function' as const,
              function: { name: tc.name, arguments: tc.args },
            })),
          });

          for (const tc of pendingToolCalls.filter(Boolean)) {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.args || '{}'); } catch { /* ignore */ }

            // Emit thinking step before executing tool
            const thinkingMsg = TOOL_THINKING[tc.name]?.(args) ?? `Using ${tc.name}…`;
            reasoningSteps.push(thinkingMsg);
            sseEvent(res, 'thinking', { step: thinkingMsg });

            const { result, component } = await executeTool(tc.name, args);

            if (component) {
              collectedComponents.push(component);
              sseEvent(res, 'component', { component });
            }

            oaiMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(sanitizeToolResult(result)),
            });
          }

          currentText = '';
        }
      }
    }

    // Persist operator message with reasoning
    await db.insert(schema.operatorMessages).values({
      id: uid(), sessionId, role: 'operator',
      content: fullContent,
      componentsJson: collectedComponents.length > 0 ? JSON.stringify(collectedComponents) : null,
      reasoningJson: reasoningSteps.length > 0 ? JSON.stringify(reasoningSteps) : null,
      createdAt: now(),
    });

    if (historyRows.length <= 1) {
      const title = content.length > 60 ? content.slice(0, 57) + '…' : content;
      await db.update(schema.operatorSessions).set({ title })
        .where(eq(schema.operatorSessions.id, sessionId));
    }

    sseEvent(res, 'done', {});
    res.end();

  } catch (err) {
    console.error('[operator] stream error:', err);
    sseEvent(res, 'error', { message: (err as Error).message });
    res.end();
  }
});
