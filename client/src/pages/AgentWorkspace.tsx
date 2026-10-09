import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useSearch } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import { operator as operatorApi, issues as issuesApi, runs as runsApi, tests as testsApi, suites as suitesApi } from "@/lib/api";
import { sendOperatorMessage } from "@/lib/operatorStream";
import { IntelligentArtifact } from '@/components/IntelligentArtifact';
import {
  Command, ArrowUp, X, ChevronDown, Check, Search, Play, Plus, BarChart2, AlertCircle,
  CheckCircle2, XCircle, MinusCircle,
  ExternalLink, PanelRight, FileCheck, ArrowLeft, UserPlus, Pencil, Settings,
  Layers, GitPullRequest, Clock, Terminal, TriangleAlert, Info, ChevronRight,
  Shuffle, RotateCcw, ListChecks, Zap, GripVertical,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Helpers ─────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Types ───────────────────────────────────────────────

export type ActionType = "Auto" | "Ask" | "Run" | "Create Test" | "Open" | "Visualize";
type RunResult = "Passed" | "Failed" | "Healed" | "Blocked" | "Running";

interface RunSummaryData {
  flow: string; result: RunResult; finding: string; time: string; env: string; href: string;
}
interface TestDraftData {
  name: string;
  project: string;
  environment: string;
  entryPoint: string;
  auth: string;
  mode: "autonomous" | "deterministic";
  // Autonomous-only
  goal?: string;
  expectedOutcome?: string;
  runnerMode?: "fast" | "standard" | "deep";
  maxSteps?: number;
  // Deterministic-only
  steps?: string[];
  selfHealing?: boolean;
}
interface ApprovalData { action: string; description: string; }
interface WorkspaceLinkData { objectType: string; title: string; href: string; }
interface ScreenshotStripData { steps: string[]; }

type InlineComp =
  | { type: "run_summary";      data: RunSummaryData }
  | { type: "test_draft";       data: TestDraftData }
  | { type: "suite_draft";      data: SuiteDraftData }
  | { type: "run_report";       data: RunReportData }
  | { type: "issue_detail";     data: IssueDetailData }
  | { type: "test_detail";      data: TestDetailData }
  | { type: "approval";         data: ApprovalData }
  | { type: "workspace_link";   data: WorkspaceLinkData }
  | { type: "screenshot_strip"; data: ScreenshotStripData }
  | { type: "bar_chart";        data: BarChartData }
  | { type: "metric_grid";      data: MetricGridData }
  | { type: "test_matrix";      data: TestMatrixData }
  | { type: "line_chart";       data: LineChartData }
  | { type: "donut_chart";      data: DonutChartData }
  | { type: "sparkline";        data: SparklineData }
  | { type: "custom_component"; data: CustomComponentData };

interface SuiteDraftData {
  name: string;
  tests: { id: string; name: string; mode: "autonomous" | "deterministic" }[];
  parallel: boolean;
  maxConcurrency: number;
  retryPolicy: "none" | "once" | "up_to_3";
  triggerOnPr: boolean;
  triggerWebhook: boolean;
  triggerScheduled: boolean;
  scheduleFrequency?: "daily" | "weekdays" | "weekly" | "monthly" | "custom";
  scheduleTime?: string;      // "HH:MM" UTC
  scheduleWeekDay?: number;   // 0-6 (Sun=0) for weekly
  scheduleMonthDay?: number;  // 1-31 for monthly
  scheduleCron?: string;      // raw cron for custom / display
}
interface RunReportData {
  runId: string;
  testName: string;
  status: "passed" | "failed" | "healed" | "blocked" | "running";
  duration: string;
  environment: string;
  branch: string;
  keyFinding: string;
  steps: { step: number; thought: string; action: string; isError: boolean }[];
  issueCount: number;
  screenshotCount: number;
  href: string;
}
interface IssueDetailData {
  issueId: string;
  title: string;
  severity: "critical" | "high" | "warning" | "info";
  status: "open" | "pushed" | "resolved" | "dismissed";
  flow: string;
  context: string;
  evidence: string;
  proposedSolution: string;
  testName: string;
  runId: string;
  href: string;
}
interface TestDetailData {
  testId: string;
  name: string;
  mode: "autonomous" | "deterministic";
  status: "pass" | "fail" | "never_run";
  environment: string;
  entryPoint: string;
  lastRunAt: string;
  estimatedCredits: number;
  goal?: string;
  stepCount?: number;
  href: string;
}

interface BarChartData {
  title: string;
  unit?: string;
  data: { label: string; value: number; color?: string }[];
}
interface MetricGridData {
  title: string;
  metrics: { label: string; value: string; subtext?: string; trend?: "up" | "down" | "flat"; trendValue?: string }[];
}
interface TestMatrixData {
  title: string;
  columns: string[];
  rows: { testName: string; statuses: ("passed" | "failed" | "healed" | "skipped" | "pending")[] }[];
}
interface LineChartData {
  title: string;
  unit?: string;
  series: { label: string; color?: string; points: { x: string; y: number }[] }[];
}
interface DonutChartData {
  title: string;
  total?: string;
  totalLabel?: string;
  slices: { label: string; value: number; color?: string }[];
}
interface SparklineData {
  title: string;
  unit?: string;
  value: string;
  subtext?: string;
  trend?: "up" | "down" | "flat";
  points: number[];
  color?: string;
}
interface CustomComponentData {
  title: string;
  html: string; // Tailwind + design-system classes, no external deps
}

interface TeamMember { id: string; name: string; initials: string; color: string; }

interface Message {
  id: string;
  role: "user" | "operator";
  content: string;
  components?: InlineComp[];
  reasoning?: string[];
  opensArtifact?: boolean;
  from?: TeamMember;
  streaming?: boolean;
}

const TEAM: TeamMember[] = [
  { id: "me", name: "Workspace owner", initials: "WO", color: "from-slate-500 to-slate-700" },
];

type Artifact =
  | { type: "test_draft";   title: string; data: TestDraftData }
  | { type: "suite_draft";  title: string; data: SuiteDraftData }
  | { type: "run_report";   title: string; data: RunReportData }
  | { type: "issue_detail"; title: string; data: IssueDetailData }
  | { type: "test_detail";  title: string; data: TestDetailData };
interface ArtifactPanelProps { artifact: Artifact; onClose: () => void; width: number; onWidthChange: (w: number) => void; }

interface HistoryItem { id: string; title: string; time: string; messageCount?: number; pageLabel?: string | null; }

// ─── Mock data ───────────────────────────────────────────

const DRAFT: TestDraftData = {
  name:            "Checkout — Payment Confirmation Regression",
  project:         "Traceback (Production)",
  environment:     "Staging",
  entryPoint:      "https://staging.example.com/checkout",
  auth:            "test-user@example.com",
  mode:            "autonomous" as const,
  goal:            "Verify POST /api/billing completes successfully and the confirmation page renders",
  expectedOutcome: "Order confirmation page displays with order ID and receipt link",
};

const DRAFT2: TestDraftData = {
  name:            "User Signup — Email Verification Flow",
  project:         "Traceback (Production)",
  environment:     "Staging",
  entryPoint:      "https://staging.example.com/signup",
  auth:            "new-user@example.com",
  mode:            "autonomous" as const,
  goal:            "Verify the signup flow sends a verification email and the link activates the account",
  expectedOutcome: "Account activated, redirect to onboarding, welcome email received in virtual mailbox",
};

const SEED_MESSAGES: Message[] = [
  // ── 1. Investigate a failure ──────────────────────────────
  {
    id: "1", role: "user",
    content: "Why did the checkout flow fail last night?",
  },
  {
    id: "2", role: "operator",
    content: "The **Checkout Flow** failed at 2:14 AM. `POST /api/billing` returned a 500 — the payment gateway sent a malformed payload the API didn't handle. The previous run at 11:40 PM healed automatically after a selector change on the confirm button. This is the second hard failure in 72 hours.",
    components: [
      { type: "run_summary", data: { flow: "Checkout Flow", result: "Failed",  finding: "POST /api/billing returned 500 — malformed gateway payload, no retry logic",       time: "2:14 AM",  env: "Production", href: "/runs/1" } },
      { type: "run_summary", data: { flow: "Checkout Flow", result: "Healed",  finding: "Confirm button selector changed — agent self-healed, flow completed successfully", time: "11:40 PM", env: "Production", href: "/runs/2" } },
      { type: "screenshot_strip", data: { steps: ["Step 1 — Cart loaded", "Step 2 — Address confirmed", "Step 3 — Payment ✗ 500"] } },
    ],
  },

  // ── 2. Open issues lookup ─────────────────────────────────
  {
    id: "3", role: "user",
    content: "Are there open issues filed from this flow?",
  },
  {
    id: "4", role: "operator",
    content: "Two open issues from this flow. The critical one flags the unhandled 500 with no fallback. The high one is a UX gap — on failure, the user sees a blank screen instead of an error message.",
    components: [
      { type: "workspace_link", data: { objectType: "Issue · Critical", title: "TR-1041 — POST /api/billing 500, no retry or fallback",        href: "/issues/1041" } },
      { type: "workspace_link", data: { objectType: "Issue · High",     title: "TR-1038 — Payment error shows blank screen, no user message", href: "/issues/1038" } },
    ],
  },

  // ── 3. Push issue to engineering ─────────────────────────
  {
    id: "5", role: "user",
    content: "Push TR-1041 to engineering and assign it to the backend team",
  },
  {
    id: "6", role: "operator",
    content: "Done — **TR-1041** has been marked as pushed and assigned to the backend team. A GitHub issue was created and linked.",
    components: [
      { type: "approval", data: { action: "Issue pushed to engineering", description: "TR-1041 marked as Pushed · Assigned: Backend Team · GitHub issue #884 created and linked" } },
      { type: "workspace_link", data: { objectType: "Issue · Pushed", title: "TR-1041 — POST /api/billing 500, no retry or fallback", href: "/issues/1041" } },
    ],
  },

  // ── 4. Pass rate trends ───────────────────────────────────
  {
    id: "7", role: "user",
    content: "What's the pass rate been like this week vs last week?",
  },
  {
    id: "8", role: "operator",
    content: "This week: **74%** across 38 runs, down from **91%** last week. The drop is concentrated in Checkout and User Signup. Healed runs are at 11% — above your 7-day average of 6%, suggesting more selector drift than usual.",
    components: [
      { type: "workspace_link", data: { objectType: "Usage", title: "Workspace trends — last 7 days", href: "/usage" } },
    ],
  },

  // ── 5. Investigate flakiness ──────────────────────────────
  {
    id: "9", role: "user",
    content: "Is User Signup flaky? Show me recent runs",
  },
  {
    id: "10", role: "operator",
    content: "Yes — **User Signup** is flaky on the email verification step. Last 10 runs: 4 passed, 3 blocked (virtual mailbox timeout), 2 healed (form selector changes), 1 failed. The timeout window is 30s but average delivery is 28s — very little margin.",
    components: [
      { type: "run_summary", data: { flow: "User Signup", result: "Blocked", finding: "Virtual mailbox timeout — verification email arrived after 30s window",           time: "6:02 AM",  env: "Staging", href: "/runs/3" } },
      { type: "run_summary", data: { flow: "User Signup", result: "Passed",  finding: "Email received at 22s — flow completed, account activated",                      time: "12:14 AM", env: "Staging", href: "/runs/4" } },
      { type: "screenshot_strip", data: { steps: ["Step 1 — Signup form submitted", "Step 2 — Email check ✗ timeout", "Step 3 — Not reached"] } },
      { type: "workspace_link", data: { objectType: "Test", title: "User Signup — Email Verification · 10-run history", href: "/tests/42" } },
    ],
  },

  // ── 6. Create test ────────────────────────────────────────
  {
    id: "11", role: "user",
    content: "/test Create a regression test for signup + email verification on staging, 60s timeout",
  },
  {
    id: "12", role: "operator",
    content: "Draft ready. I've set the virtual mailbox timeout to 60s and pointed the entry point at staging. Expand below to review fields — approve to save it to your library.",
    components: [
      { type: "test_draft", data: DRAFT2 },
      { type: "approval",   data: { action: "Save test definition", description: "Saves to your library. You can run it immediately or add it to a suite." } },
    ],
    opensArtifact: true,
  },

  // ── 7. Also create checkout test ─────────────────────────
  {
    id: "13", role: "user",
    content: "/test Create the checkout payment regression test too — staging, auth as test user",
  },
  {
    id: "14", role: "operator",
    content: "Here's the checkout draft. Entry point at `/checkout`, goal targets the `POST /api/billing` step. The artifact panel is open on the right if you want to edit before saving.",
    components: [
      { type: "test_draft", data: DRAFT },
      { type: "approval",   data: { action: "Save test definition", description: "Creates and saves this test. You can run it immediately after." } },
    ],
    opensArtifact: true,
  },

  // ── 8. Run a test ─────────────────────────────────────────
  {
    id: "15", role: "user",
    content: "Run the checkout regression test on staging now",
  },
  {
    id: "16", role: "operator",
    content: "Kicked off **Checkout — Payment Confirmation Regression** on staging. Watch it live or wait here — I'll surface the result when it completes.",
    components: [
      { type: "run_summary", data: { flow: "Checkout — Payment Confirmation Regression", result: "Running", finding: "Step 1 of 7 in progress — navigating to checkout", time: "just now", env: "Staging", href: "/runs/live/autonomous" } },
      { type: "workspace_link", data: { objectType: "Live Run", title: "Watch live → Checkout — Payment Confirmation Regression", href: "/runs/live/autonomous" } },
    ],
  },

  // ── 9. Run a full suite ───────────────────────────────────
  {
    id: "17", role: "user",
    content: "/run Run the nightly regression suite on staging",
  },
  {
    id: "18", role: "operator",
    content: "Running **Nightly Regression Suite** on staging — 12 tests queued, estimated 18 minutes. Results will appear in the suite run report when complete.",
    components: [
      { type: "approval", data: { action: "Suite run initiated", description: "Nightly Regression Suite · 12 tests · Staging · Parallel execution enabled" } },
      { type: "workspace_link", data: { objectType: "Suite", title: "Nightly Regression Suite — view progress", href: "/suites/1" } },
    ],
  },

  // ── 10. Compare two runs ──────────────────────────────────
  {
    id: "19", role: "user",
    content: "/compare Compare this week's checkout runs to last week",
  },
  {
    id: "20", role: "operator",
    content: "This week the Checkout flow passed 3/8 runs (38%) vs 7/8 last week (88%). The main regression is the billing API 500 — that didn't appear last week at all. Heal rate also doubled from 12% to 25%.",
    components: [
      { type: "run_summary", data: { flow: "Checkout Flow · This week",  result: "Failed", finding: "3 of 8 passed — billing 500 accounts for all failures", time: "Week of Apr 1", env: "Production", href: "/runs" } },
      { type: "run_summary", data: { flow: "Checkout Flow · Last week",  result: "Passed", finding: "7 of 8 passed — 1 healed on selector change, no hard failures", time: "Week of Mar 25", env: "Production", href: "/runs" } },
      { type: "workspace_link", data: { objectType: "Usage", title: "Compare view — Checkout Flow · 2-week trend", href: "/usage" } },
    ],
  },

  // ── 11. Resolve an issue ──────────────────────────────────
  {
    id: "21", role: "user",
    content: "The blank screen issue on checkout error is fixed — mark TR-1038 as resolved",
  },
  {
    id: "22", role: "operator",
    content: "**TR-1038** has been marked as resolved. The linked run from today confirmed the error state now shows a user-facing message.",
    components: [
      { type: "approval", data: { action: "Issue resolved", description: "TR-1038 — Payment error shows blank screen · Status: Resolved · Linked to run from 10:41 AM" } },
      { type: "workspace_link", data: { objectType: "Issue · Resolved", title: "TR-1038 — Payment error state resolved", href: "/issues/1038" } },
    ],
  },
];

const HISTORY: HistoryItem[] = [
  { id: "h1",  title: "Checkout flow failure — payment API 500",         time: "2h ago"     },
  { id: "h2",  title: "Regression test for payment confirmation",         time: "5h ago"     },
  { id: "h3",  title: "Flaky tests on User Signup — last 10 runs",       time: "yesterday"  },
  { id: "h4",  title: "Run full regression suite on staging",             time: "yesterday"  },
  { id: "h5",  title: "Why is the onboarding flow 3× slower in Firefox?", time: "2 days ago" },
  { id: "h6",  title: "Compare pass rates across last 30 days",           time: "2 days ago" },
  { id: "h7",  title: "Create autonomous test for password reset",        time: "3 days ago" },
  { id: "h8",  title: "Open all critical issues from last week",          time: "3 days ago" },
  { id: "h9",  title: "Visualize test coverage by flow",                  time: "4 days ago" },
  { id: "h10", title: "Auth token expiry — investigate 401 spike",        time: "5 days ago" },
  { id: "h11", title: "Suite run report — nightly regression March 28",   time: "5 days ago" },
  { id: "h12", title: "Blocked test on mobile viewport — root cause",     time: "6 days ago" },
];

// ─── Inline component renderers ──────────────────────────

function ResultIcon({ result }: { result: RunResult }) {
  if (result === "Passed")  return <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a] shrink-0" />;
  if (result === "Failed")  return <XCircle       className="w-3.5 h-3.5 text-destructive shrink-0" />;
  if (result === "Blocked") return <MinusCircle   className="w-3.5 h-3.5 text-orange-500 shrink-0" />;
  if (result === "Running") return <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0 mt-0.5" />;
  return <CheckCircle2 className="w-3.5 h-3.5 text-[#0e9f6e] shrink-0" />;
}

function RunSummaryCard({ data }: { data: RunSummaryData }) {
  return (
    <Link href={data.href} className="block border border-border/50 rounded-[8px] p-4 mt-3 hover:bg-muted/20 transition-colors">
      <div className="flex items-start gap-2 mb-1.5">
        <ResultIcon result={data.result} />
        <span className="text-[13px] font-medium text-foreground">{data.flow}</span>
        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{data.env} · {data.time}</span>
      </div>
      <p className="text-[12px] text-muted-foreground pl-[22px]">{data.finding}</p>
    </Link>
  );
}

function TestDraftCard({ data, onOpen, defaultOpen = false }: { data: TestDraftData; onOpen: (data: TestDraftData) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const sharedFields: [string, string][] = [
    ["Project",      data.project],
    ["Environment",  data.environment],
    ["Entry point",  data.entryPoint],
    ["Auth",         data.auth],
  ];
  return (
    <div className="border border-border/50 rounded-[8px] overflow-hidden mt-3">
      <div className="px-4 py-2.5 bg-muted/20 flex items-center gap-3">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground truncate">{data.name}</span>
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0", data.mode === "autonomous" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground")}>
              {data.mode === "autonomous" ? "Autonomous" : "Deterministic"}
            </span>
          </div>
        </button>
        <button onClick={() => onOpen(data)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <PanelRight className="w-3.5 h-3.5" /> Edit
        </button>
      </div>
      {open && (
        <div className="divide-y divide-border/30 border-t border-border/40">
          {sharedFields.map(([label, value]) => (
            <div key={label} className="flex px-4 py-2 gap-4">
              <span className="text-[11px] text-muted-foreground w-[130px] shrink-0 pt-px">{label}</span>
              <span className="text-[12px] text-foreground leading-relaxed">{value}</span>
            </div>
          ))}
          {data.mode === "autonomous" && (
            <>
              {data.goal && (
                <div className="flex px-4 py-2 gap-4">
                  <span className="text-[11px] text-muted-foreground w-[130px] shrink-0 pt-px">Goal</span>
                  <span className="text-[12px] text-foreground leading-relaxed">{data.goal}</span>
                </div>
              )}
              {data.expectedOutcome && (
                <div className="flex px-4 py-2 gap-4">
                  <span className="text-[11px] text-muted-foreground w-[130px] shrink-0 pt-px">Expected outcome</span>
                  <span className="text-[12px] text-foreground leading-relaxed">{data.expectedOutcome}</span>
                </div>
              )}
            </>
          )}
          {data.mode === "deterministic" && (
            <div className="px-4 py-2">
              <span className="text-[11px] text-muted-foreground block mb-1.5">{data.steps?.length ?? 0} steps</span>
              <ol className="space-y-1">
                {(data.steps ?? []).slice(0, 3).map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-foreground">
                    <span className="text-[10px] font-mono text-muted-foreground mt-0.5 w-4 shrink-0">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
                {(data.steps?.length ?? 0) > 3 && (
                  <li className="text-[11px] text-muted-foreground/60 pl-6">+{(data.steps?.length ?? 0) - 3} more steps</li>
                )}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ data }: { data: ApprovalData }) {
  const [state, setState] = useState<"idle" | "approved">("idle");
  if (state === "approved") {
    return (
      <div className="flex items-center gap-2 mt-3 text-[12px] text-[#16a34a]">
        <Check className="w-3.5 h-3.5" /> Test saved to library —{" "}
        <Link href="/tests" className="underline underline-offset-2 hover:text-[#16a34a]/80 transition-colors">View in library</Link>
      </div>
    );
  }
  return (
    <div className="border border-border/40 rounded-[8px] p-4 mt-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">{data.action}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">{data.description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">Discard</button>
        <button onClick={() => setState("approved")} className="btn-precision px-3 py-1.5 text-[12px] bg-foreground/80 dark:bg-white/[0.04] text-background dark:text-foreground dark:border dark:border-white/[0.12] dark:hover:bg-white/[0.08] dark:hover:border-white/[0.2] rounded-[6px] hover:bg-foreground transition-colors">
          Approve & save
        </button>
      </div>
    </div>
  );
}

function WorkspaceLinkCard({ data }: { data: WorkspaceLinkData }) {
  return (
    <div className="border border-border/40 rounded-[8px] p-3 mt-2 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{data.objectType}</div>
        <div className="text-[12px] font-medium text-foreground truncate">{data.title}</div>
      </div>
      <Link href={data.href} className="btn-precision btn-secondary px-2.5 py-1 text-[12px] flex items-center gap-1 shrink-0">
        <ExternalLink className="w-3 h-3" /> Open
      </Link>
    </div>
  );
}

function ScreenshotStrip({ data }: { data: ScreenshotStripData }) {
  return (
    <div className="flex gap-2 mt-3">
      {data.steps.map((step, i) => (
        <div key={i} className="flex-1 aspect-video bg-muted/40 border border-border/40 rounded-[6px] flex items-end p-2 overflow-hidden">
          <span className="text-[9px] text-muted-foreground truncate w-full">{step}</span>
        </div>
      ))}
    </div>
  );
}

function SuiteDraftCard({ data, onOpen }: { data: SuiteDraftData; onOpen: (data: SuiteDraftData) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/50 rounded-[8px] overflow-hidden mt-3">
      <div className="px-4 py-2.5 bg-muted/20 flex items-center gap-3">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
          <div className="min-w-0">
            <span className="text-[13px] font-semibold text-foreground truncate block">{data.name}</span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Suite Draft · {data.tests.length} tests</span>
          </div>
        </button>
        <button onClick={() => onOpen(data)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <PanelRight className="w-3.5 h-3.5" /> Configure
        </button>
      </div>
      {open && (
        <div className="divide-y divide-border/30 border-t border-border/40">
          {data.tests.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2">
              <span className="text-[12px] text-foreground flex-1">{t.name}</span>
              <span className="text-[10px] text-muted-foreground">{t.mode === "autonomous" ? "Auto" : "Det"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunReportCard({ data, onOpen }: { data: RunReportData; onOpen: (data: RunReportData) => void }) {
  const s = STATUS_CONFIG[data.status];
  return (
    <div className="border border-border/50 rounded-[8px] p-4 mt-3 flex items-center gap-3 hover:bg-muted/10 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", s.cls)}>{s.label}</span>
          <span className="text-[13px] font-medium text-foreground truncate">{data.testName}</span>
        </div>
        <p className="text-[12px] text-muted-foreground truncate">{data.keyFinding || `${data.environment} · ${data.duration}`}</p>
      </div>
      <button onClick={() => onOpen(data)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0">
        <PanelRight className="w-3.5 h-3.5" /> Expand
      </button>
    </div>
  );
}

function IssueDetailCard({ data, onOpen }: { data: IssueDetailData; onOpen: (data: IssueDetailData) => void }) {
  const sev = SEV_CONFIG[data.severity];
  return (
    <div className="border border-border/50 rounded-[8px] p-4 mt-3 flex items-center gap-3 hover:bg-muted/10 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full", sev.cls)}>
            <sev.Icon className="w-2.5 h-2.5" />{sev.label}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">{data.issueId}</span>
        </div>
        <p className="text-[13px] font-medium text-foreground truncate">{data.title}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{data.flow}</p>
      </div>
      <button onClick={() => onOpen(data)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0">
        <PanelRight className="w-3.5 h-3.5" /> Details
      </button>
    </div>
  );
}

function TestDetailCard({ data, onOpen }: { data: TestDetailData; onOpen: (data: TestDetailData) => void }) {
  const s = TEST_STATUS_CONFIG[data.status];
  return (
    <div className="border border-border/50 rounded-[8px] p-4 mt-3 flex items-center gap-3 hover:bg-muted/10 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", s.cls)}>{s.label}</span>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", data.mode === "autonomous" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground")}>
            {data.mode === "autonomous" ? "Autonomous" : "Deterministic"}
          </span>
        </div>
        <p className="text-[13px] font-medium text-foreground truncate">{data.name}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{data.entryPoint}</p>
      </div>
      <button onClick={() => onOpen(data)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0">
        <PanelRight className="w-3.5 h-3.5" /> View
      </button>
    </div>
  );
}

function BarChartCard({ data }: { data: BarChartData }) {
  const max = Math.max(...data.data.map(d => d.value), 1);
  const COLOR_MAP: Record<string, string> = {
    accent: "bg-accent",
    green:  "bg-[#16a34a]",
    red:    "bg-[#dc2626]",
    yellow: "bg-[#ca8a04]",
  };
  return (
    <div className="border border-border/50 rounded-[8px] p-4 mt-3">
      <p className="text-[12px] font-semibold text-foreground mb-3">{data.title}</p>
      <div className="space-y-2">
        {data.data.map((d, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground w-[120px] shrink-0 truncate text-right">{d.label}</span>
            <div className="flex-1 h-5 bg-muted/30 rounded-[3px] overflow-hidden">
              <div
                className={cn("h-full rounded-[3px] transition-all", COLOR_MAP[d.color ?? ""] ?? "bg-accent")}
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </div>
            <span className="text-[11.5px] text-foreground tabular-nums w-10 shrink-0">
              {d.value}{data.unit ? ` ${data.unit}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricGridCard({ data }: { data: MetricGridData }) {
  const TREND_ICON: Record<string, string> = { up: "↑", down: "↓", flat: "→" };
  const TREND_COLOR: Record<string, string> = { up: "text-[#16a34a]", down: "text-[#dc2626]", flat: "text-muted-foreground" };
  return (
    <div className="border border-border/50 rounded-[8px] p-4 mt-3">
      {data.title && <p className="text-[12px] font-semibold text-foreground mb-3">{data.title}</p>}
      <div className="grid grid-cols-2 gap-2">
        {data.metrics.map((m, i) => (
          <div key={i} className="bg-muted/30 rounded-[6px] px-3 py-2.5">
            <p className="text-[10.5px] text-muted-foreground mb-0.5">{m.label}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[18px] font-semibold text-foreground leading-none">{m.value}</span>
              {m.trend && (
                <span className={cn("text-[11px] font-medium", TREND_COLOR[m.trend])}>
                  {TREND_ICON[m.trend]}{m.trendValue}
                </span>
              )}
            </div>
            {m.subtext && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{m.subtext}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TestMatrixCard({ data }: { data: TestMatrixData }) {
  const STATUS_DOT: Record<string, string> = {
    passed:  "bg-[#16a34a]",
    failed:  "bg-[#dc2626]",
    healed:  "bg-[#ca8a04]",
    skipped: "bg-muted-foreground/30",
    pending: "bg-muted/60 border border-border/40",
  };
  return (
    <div className="border border-border/50 rounded-[8px] p-4 mt-3 overflow-x-auto">
      {data.title && <p className="text-[12px] font-semibold text-foreground mb-3">{data.title}</p>}
      <table className="w-full text-[11px]">
        <thead>
          <tr>
            <th className="text-left text-muted-foreground font-normal pb-2 pr-4 min-w-[120px]">Test</th>
            {data.columns.map(c => (
              <th key={c} className="text-center text-muted-foreground font-normal pb-2 px-2 whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="border-t border-border/20">
              <td className="py-1.5 pr-4 text-foreground truncate max-w-[140px]">{row.testName}</td>
              {row.statuses.map((s, j) => (
                <td key={j} className="py-1.5 px-2 text-center">
                  <span className={cn("inline-block w-2.5 h-2.5 rounded-full", STATUS_DOT[s] ?? "bg-muted")} title={s} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {Object.entries(STATUS_DOT).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1 text-[10px] text-muted-foreground capitalize">
            <span className={cn("w-2 h-2 rounded-full inline-block", v)} />{k}
          </span>
        ))}
      </div>
    </div>
  );
}

function LineChartCard({ data }: { data: LineChartData }) {
  const allY = data.series.flatMap(s => s.points.map(p => p.y));
  const minY = Math.min(...allY, 0);
  const maxY = Math.max(...allY, 1);
  const range = maxY - minY || 1;
  const H = 80; // SVG height for the plot area
  const SERIES_COLORS: Record<string, string> = {
    accent: "hsl(220 82% 65%)", green: "#16a34a", red: "#dc2626", yellow: "#ca8a04",
  };
  const defaultColors = ["hsl(220 82% 65%)", "#16a34a", "#ca8a04", "#dc2626", "#a855f7"];

  return (
    <div className="border border-border/50 rounded-[8px] p-4 mt-3">
      <p className="text-[12px] font-semibold text-foreground mb-3">{data.title}</p>
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 400 ${H + 24}`}
          className="w-full"
          preserveAspectRatio="none"
          style={{ height: H + 24 }}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <line
              key={t}
              x1={0} y1={H * t}
              x2={400} y2={H * t}
              stroke="currentColor"
              strokeOpacity={0.06}
              strokeWidth={1}
            />
          ))}
          {data.series.map((s, si) => {
            if (s.points.length < 2) return null;
            const color = SERIES_COLORS[s.color ?? ""] ?? defaultColors[si % defaultColors.length];
            const xStep = 400 / (s.points.length - 1);
            const pts = s.points.map((p, i) => ({
              x: i * xStep,
              y: H - ((p.y - minY) / range) * H,
            }));
            const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
            const areaD = `${d} L ${pts[pts.length - 1].x.toFixed(1)} ${H} L 0 ${H} Z`;
            return (
              <g key={si}>
                <path d={areaD} fill={color} fillOpacity={0.08} />
                <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
                ))}
              </g>
            );
          })}
          {/* X labels */}
          {data.series[0]?.points.map((p, i) => {
            const xStep = 400 / Math.max(data.series[0].points.length - 1, 1);
            const every = Math.ceil(data.series[0].points.length / 6);
            if (i % every !== 0 && i !== data.series[0].points.length - 1) return null;
            return (
              <text
                key={i}
                x={i * xStep}
                y={H + 16}
                textAnchor="middle"
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.4}
              >
                {p.x}
              </text>
            );
          })}
        </svg>
      </div>
      {data.series.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-2">
          {data.series.map((s, si) => {
            const SERIES_COLORS_MAP: Record<string, string> = {
              accent: "bg-accent", green: "bg-[#16a34a]", red: "bg-[#dc2626]", yellow: "bg-[#ca8a04]",
            };
            const defaultBgColors = ["bg-accent", "bg-[#16a34a]", "bg-[#ca8a04]", "bg-[#dc2626]", "bg-purple-500"];
            const bg = SERIES_COLORS_MAP[s.color ?? ""] ?? defaultBgColors[si % defaultBgColors.length];
            return (
              <span key={si} className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                <span className={cn("w-2.5 h-2.5 rounded-sm", bg)} />{s.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DonutChartCard({ data }: { data: DonutChartData }) {
  const total = data.slices.reduce((s, d) => s + d.value, 0) || 1;
  const COLORS: Record<string, string> = {
    accent: "hsl(220 82% 65%)", green: "#16a34a", red: "#dc2626", yellow: "#ca8a04", purple: "#a855f7", orange: "#f97316",
  };
  const defaultColors = ["hsl(220 82% 65%)", "#16a34a", "#ca8a04", "#dc2626", "#a855f7", "#f97316"];
  const R = 52, CX = 70, CY = 70, strokeW = 18;
  const circumference = 2 * Math.PI * R;

  let cumulative = 0;
  const arcs = data.slices.map((s, i) => {
    const frac = s.value / total;
    const offset = circumference * (1 - cumulative);
    const dash = circumference * frac;
    cumulative += frac;
    const color = COLORS[s.color ?? ""] ?? defaultColors[i % defaultColors.length];
    return { ...s, dash, offset, color, frac };
  });

  return (
    <div className="border border-border/50 rounded-[8px] p-4 mt-3">
      <p className="text-[12px] font-semibold text-foreground mb-3">{data.title}</p>
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <svg width={140} height={140} viewBox="0 0 140 140">
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="currentColor" strokeOpacity={0.06} strokeWidth={strokeW} />
            {arcs.map((arc, i) => (
              <circle
                key={i}
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeW}
                strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
                strokeDashoffset={arc.offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${CX} ${CY})`}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[18px] font-semibold text-foreground leading-none">{data.total ?? total}</span>
            {data.totalLabel && <span className="text-[9.5px] text-muted-foreground mt-0.5">{data.totalLabel}</span>}
          </div>
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          {arcs.map((arc, i) => (
            <div key={i} className="flex items-center gap-2 text-[11.5px]">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: arc.color }} />
              <span className="text-foreground truncate flex-1">{arc.label}</span>
              <span className="text-muted-foreground tabular-nums">{arc.value}</span>
              <span className="text-muted-foreground/50 tabular-nums w-10 text-right">{Math.round(arc.frac * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SparklineCard({ data }: { data: SparklineData }) {
  const pts = data.points;
  if (!pts.length) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts, min + 1);
  const range = max - min;
  const H = 32, W = 120;
  const step = W / Math.max(pts.length - 1, 1);
  const svgPts = pts.map((v, i) => `${(i * step).toFixed(1)},${(H - ((v - min) / range) * H).toFixed(1)}`).join(" ");
  const TREND_ICON: Record<string, string> = { up: "↑", down: "↓", flat: "→" };
  const TREND_COLOR: Record<string, string> = { up: "text-[#16a34a]", down: "text-[#dc2626]", flat: "text-muted-foreground" };
  const COLOR_MAP: Record<string, string> = { accent: "hsl(220 82% 65%)", green: "#16a34a", red: "#dc2626", yellow: "#ca8a04" };
  const color = COLOR_MAP[data.color ?? ""] ?? "hsl(220 82% 65%)";

  return (
    <div className="border border-border/50 rounded-[8px] px-4 py-3 mt-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-[10.5px] text-muted-foreground mb-0.5">{data.title}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[22px] font-semibold text-foreground leading-none">{data.value}</span>
          {data.unit && <span className="text-[11px] text-muted-foreground">{data.unit}</span>}
          {data.trend && (
            <span className={cn("text-[11px] font-medium", TREND_COLOR[data.trend])}>
              {TREND_ICON[data.trend]}
            </span>
          )}
        </div>
        {data.subtext && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{data.subtext}</p>}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
        <polyline
          points={svgPts}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {(() => {
          const last = pts[pts.length - 1];
          const lx = (pts.length - 1) * step;
          const ly = H - ((last - min) / range) * H;
          return <circle cx={lx} cy={ly} r={3} fill={color} />;
        })()}
      </svg>
    </div>
  );
}

function CustomComponentCard({ data }: { data: CustomComponentData }) {
  return (
    <div className="border border-border/50 rounded-[8px] overflow-hidden mt-3">
      {data.title && (
        <div className="px-4 py-2 bg-muted/20 border-b border-border/30">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{data.title}</p>
        </div>
      )}
      <IntelligentArtifact html={data.html} title={data.title || 'Agent artifact'} />
    </div>
  );
}

function InlineComponents({ comps, onOpenArtifact }: { comps: InlineComp[]; onOpenArtifact: (artifact: Artifact) => void }) {
  return (
    <div className="space-y-1 mt-1">
      {comps.map((c, i) => {
        if (c.type === "run_summary")      return <RunSummaryCard    key={i} data={c.data} />;
        if (c.type === "test_draft")       return <TestDraftCard     key={i} data={c.data} onOpen={(d) => onOpenArtifact({ type: "test_draft",   title: d.name,      data: d })} />;
        if (c.type === "suite_draft")      return <SuiteDraftCard    key={i} data={c.data} onOpen={(d) => onOpenArtifact({ type: "suite_draft",  title: d.name,      data: d })} />;
        if (c.type === "run_report")       return <RunReportCard     key={i} data={c.data} onOpen={(d) => onOpenArtifact({ type: "run_report",   title: d.testName,  data: d })} />;
        if (c.type === "issue_detail")     return <IssueDetailCard   key={i} data={c.data} onOpen={(d) => onOpenArtifact({ type: "issue_detail", title: d.title,     data: d })} />;
        if (c.type === "test_detail")      return <TestDetailCard    key={i} data={c.data} onOpen={(d) => onOpenArtifact({ type: "test_detail",  title: d.name,      data: d })} />;
        if (c.type === "approval")         return <ApprovalCard      key={i} data={c.data} />;
        if (c.type === "workspace_link")   return <WorkspaceLinkCard key={i} data={c.data} />;
        if (c.type === "screenshot_strip") return <ScreenshotStrip  key={i} data={c.data} />;
        if (c.type === "bar_chart")        return <BarChartCard        key={i} data={c.data} />;
        if (c.type === "metric_grid")      return <MetricGridCard      key={i} data={c.data} />;
        if (c.type === "test_matrix")      return <TestMatrixCard      key={i} data={c.data} />;
        if (c.type === "line_chart")       return <LineChartCard       key={i} data={c.data} />;
        if (c.type === "donut_chart")      return <DonutChartCard      key={i} data={c.data} />;
        if (c.type === "sparkline")        return <SparklineCard       key={i} data={c.data} />;
        if (c.type === "custom_component") return <CustomComponentCard key={i} data={c.data} />;
        return null;
      })}
    </div>
  );
}

// ─── Markdown prose ──────────────────────────────────────

function Prose({ text }: { text: string }) {
  // Strip AI hallucinations: base64 images and raw HTML blocks
  const cleaned = text
    .replace(/!\[.*?\]\(data:[^\)]*\)?/gs, "")
    .replace(/!\[.*?\]\(data:[\s\S]*$/g, "")
    .replace(/<[a-zA-Z][^>]*>[\s\S]*?<\/[a-zA-Z]+>/g, "")
    .replace(/<[a-zA-Z][^>]*\/>/g, "")
    .trim();
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="text-[13.5px] text-foreground leading-relaxed mb-3 last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-foreground/80">{children}</em>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.startsWith("language-");
          if (isBlock) {
            return (
              <code className="block font-mono text-[12px] bg-muted/50 border border-border/40 rounded-lg px-4 py-3 my-3 text-foreground/90 whitespace-pre overflow-x-auto">
                {children}
              </code>
            );
          }
          return (
            <code className="font-mono text-[11.5px] bg-muted/60 border border-border/30 px-1.5 py-0.5 rounded text-foreground/90">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        ul: ({ children }) => (
          <ul className="my-2.5 space-y-1.5 pl-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2.5 space-y-1.5 pl-1 counter-reset-[item]">{children}</ol>
        ),
        li: ({ children, ordered, index }: any) => (
          ordered
            ? (
              <li className="text-[13.5px] text-foreground leading-relaxed flex gap-2.5 items-start">
                <span className="mt-[1px] shrink-0 min-w-[18px] text-[11px] font-semibold text-accent/80 tabular-nums">
                  {(index ?? 0) + 1}.
                </span>
                <span>{children}</span>
              </li>
            ) : (
              <li className="text-[13.5px] text-foreground leading-relaxed flex gap-2.5 items-start">
                <span className="mt-[7px] shrink-0 w-1.5 h-1.5 rounded-full bg-accent/70" />
                <span>{children}</span>
              </li>
            )
        ),
        h1: ({ children }) => (
          <h1 className="text-[15px] font-semibold text-foreground mt-5 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-[14px] font-semibold text-foreground mt-4 mb-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-[13.5px] font-semibold text-foreground mt-3 mb-1 first:mt-0">{children}</h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-accent/40 pl-3 my-2.5 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-border/30 my-4" />,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer"
            className="text-accent hover:text-accent/80 underline underline-offset-2 decoration-accent/30 hover:decoration-accent/50 transition-colors">
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-[12.5px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-muted/40 border-b border-border/40">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-medium text-foreground/70 text-[11.5px] uppercase tracking-wide">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-foreground/80 border-b border-border/20 last:border-0">
            {children}
          </td>
        ),
        img: ({ src, alt }) => {
          if (!src || src.startsWith("data:")) return null;
          return <img src={src} alt={alt} className="max-w-full rounded-[6px] my-2" />;
        },
      }}
    >
      {cleaned}
    </ReactMarkdown>
  );
}

// ─── Message ─────────────────────────────────────────────

// Loading dots (shown while no content/thinking yet)
function OperatorThinking() {
  return (
    <div className="mb-8 flex items-center gap-[5px]">
      {[0, 1, 2].map(i => (
        <span key={i} className="block w-[5px] h-[5px] rounded-full bg-foreground/40"
          style={{ animation: `opWave 1.2s ease-in-out ${i * 0.15}s infinite` }} />
      ))}
      <style>{`@keyframes opWave{0%,60%,100%{transform:translateY(0);opacity:.25}30%{transform:translateY(-5px);opacity:.85}}`}</style>
    </div>
  );
}

// Thinking step shown while model is working (before text arrives)
function ThinkingStep({ step }: { step: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="block w-[5px] h-[5px] rounded-full bg-accent shrink-0"
        style={{ animation: "opDot 1.4s ease-in-out infinite" }} />
      <span className="text-[12px] text-muted-foreground/60 italic">{step}</span>
    </div>
  );
}

// Collapsible reasoning trace shown after response is complete
function ReasoningTrace({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors group"
      >
        <ChevronRight className={cn("w-3 h-3 transition-transform", open && "rotate-90")} />
        <span>{steps.length} reasoning step{steps.length !== 1 ? "s" : ""}</span>
      </button>
      {open && (
        <div className="mt-2 pl-4 border-l border-border/30 space-y-1.5">
          {steps.map((step, i) => (
            <p key={i} className="text-[11.5px] text-muted-foreground/50 leading-relaxed">{step}</p>
          ))}
        </div>
      )}
    </div>
  );
}

interface SuggestedChip { label: string; prompt: string; }

function getSuggestedChips(msg: Message): SuggestedChip[] {
  if (!msg.components?.length || !msg.content) return [];
  const types = msg.components.map(c => c.type);
  const chips: SuggestedChip[] = [];
  if (types.includes('issue_detail')) {
    const issue = msg.components.find(c => c.type === 'issue_detail')?.data as IssueDetailData;
    chips.push({ label: 'Push to Linear', prompt: `Push ${issue?.issueId ?? 'this issue'} to Linear` });
    chips.push({ label: 'Dismiss', prompt: `Dismiss ${issue?.issueId ?? 'this issue'} as won't fix` });
  }
  if (types.includes('run_report') || types.includes('run_summary')) {
    chips.push({ label: 'Create issue', prompt: 'Create an issue from this run failure' });
    chips.push({ label: 'Rerun', prompt: 'Run this test again on staging' });
  }
  if (types.includes('test_draft')) {
    chips.push({ label: 'Save test', prompt: 'Save this test to the library' });
    chips.push({ label: 'Run after saving', prompt: 'Save and immediately run this test on staging' });
  }
  if (types.includes('suite_draft')) {
    chips.push({ label: 'Save suite', prompt: 'Save this suite' });
    chips.push({ label: 'Run now', prompt: 'Save and run this suite on staging' });
  }
  if (types.includes('metric_grid') || types.includes('bar_chart')) {
    chips.push({ label: '7-day trend', prompt: 'Show me the pass rate trend over the last 7 days' });
    chips.push({ label: 'Export report', prompt: 'Generate a summary of this data as a report' });
  }
  return chips.slice(0, 3);
}

function MessageItem({ msg, onOpenArtifact, showFrom, onChipClick }: { msg: Message; onOpenArtifact: (artifact: Artifact) => void; showFrom?: boolean; onChipClick?: (prompt: string) => void }) {
  const sender = msg.from ?? TEAM[0];
  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-6 gap-2 items-end">
        <div className="max-w-[72%] text-right">
          {showFrom && <p className="text-[11px] text-muted-foreground mb-1 pr-1">{sender.name}</p>}
          <div className="bg-muted/40 border border-border/40 rounded-[10px] px-4 py-3 inline-block text-left">
            <p className="text-[13px] text-foreground">{msg.content}</p>
          </div>
        </div>
        {showFrom && <MemberAvatar m={sender} size="xs" />}
      </div>
    );
  }

  // Still loading — show thinking dots or live thinking steps
  if (msg.role === "operator" && !msg.content && !msg.components?.length) {
    return (
      <div className="mb-8">
        {msg.reasoning && msg.reasoning.length > 0
          ? <div className="space-y-0">{msg.reasoning.map((s, i) => <ThinkingStep key={i} step={s} />)}</div>
          : <OperatorThinking />
        }
      </div>
    );
  }

  return (
    <div className="mb-8">
      {/* Reasoning trace — collapsed by default, shows after response is complete */}
      {msg.reasoning && msg.reasoning.length > 0 && msg.content && (
        <ReasoningTrace steps={msg.reasoning} />
      )}
      <div className="max-w-[640px]">
        <Prose text={msg.content} />
      </div>
      {msg.components && <InlineComponents comps={msg.components} onOpenArtifact={onOpenArtifact} />}
      {msg.role === "operator" && msg.content && onChipClick && (() => {
        const chips = getSuggestedChips(msg);
        if (!chips.length) return null;
        return (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/20">
            {chips.map(c => (
              <button
                key={c.label}
                onClick={() => onChipClick(c.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-border/40 bg-muted/20 hover:bg-muted/40 hover:border-border/70 transition-colors text-[12px] text-foreground"
              >
                {c.label}
              </button>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Artifact panel ──────────────────────────────────────

// Shared panel shell — handles drag resize and outer frame
function ArtifactShell({ title, badge, badgeIcon, canEdit, editing, onEdit, onClose, width, dragRef, children, footer }: {
  title: string; badge: string; badgeIcon: React.ReactNode;
  canEdit?: boolean; editing?: boolean; onEdit?: () => void; onClose: () => void;
  width: number; dragRef: React.RefObject<HTMLDivElement>;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div style={{ width: `${width}px`, right: `calc((100% - ${720 + 24 + width}px) / 2)` }} className="absolute top-2 bottom-6 z-20 flex flex-col">
      <div className="flex-1 bg-background border border-border/50 rounded-[10px] shadow-[0_2px_16px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden relative">
        <div ref={dragRef} className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 hover:bg-primary/20 transition-colors" />
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-1 bg-muted/70 text-muted-foreground rounded-full px-2 py-0.5 shrink-0">
            {badgeIcon}
            <span className="text-[10px] font-medium uppercase tracking-wider">{badge}</span>
          </div>
          <span className="text-[13px] font-semibold text-foreground truncate flex-1 min-w-0">{title}</span>
          <div className="flex items-center gap-0.5 shrink-0">
            {canEdit && (
              <button onClick={onEdit} className={cn("p-1.5 rounded-[6px] transition-colors", editing ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")} title={editing ? "Done" : "Edit"}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">{children}</div>
        {footer && <div className="border-t border-border px-4 py-3 flex gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// ── Test Draft panel ─────────────────────────────────────

function TestDraftPanel({ data, onClose, width, dragRef }: { data: TestDraftData; onClose: () => void; width: number; dragRef: React.RefObject<HTMLDivElement> }) {
  const [draft, setDraft] = useState<TestDraftData>({ ...data });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const modeLabel = draft.mode === "deterministic" ? "Deterministic" : "Autonomous";

  return (
    <ArtifactShell
      title={draft.name}
      badge={`${modeLabel} Draft`}
      badgeIcon={<FileCheck className="w-3 h-3" />}
      onClose={onClose}
      width={width}
      dragRef={dragRef}
      canEdit={!saved}
      editing={editing}
      onEdit={() => setEditing(v => !v)}
      footer={!saved ? (
        editing ? (
          <>
            <button onClick={() => { setEditing(false); setDraft({ ...data }); }} className="px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted rounded-[7px] transition-colors flex-1">Cancel</button>
            <button onClick={() => { setEditing(false); setSaved(true); }} className="px-3 py-1.5 text-[12px] bg-primary text-primary-foreground hover:bg-primary/90 rounded-[7px] font-medium transition-colors flex-1">Save</button>
          </>
        ) : (
          <>
            {saved && <span className="text-[11px] text-[#16a34a] flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
            <button className="px-3 py-1.5 text-[12px] bg-foreground/80 dark:bg-white/[0.04] text-background dark:text-foreground dark:border dark:border-white/[0.12] dark:hover:bg-white/[0.08] dark:hover:border-white/[0.2] hover:bg-foreground rounded-[7px] font-medium transition-colors flex-1 flex items-center justify-center gap-1.5">
              <Plus className="w-3 h-3" /> Save to Library
            </button>
          </>
        )
      ) : undefined}
    >
      {saved ? (
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center h-full">
          <div className="w-10 h-10 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
            <Check className="w-5 h-5 text-[#16a34a]" />
          </div>
          <p className="text-[14px] font-semibold text-foreground">Test saved</p>
          <p className="text-[12px] text-muted-foreground">Added to your test library</p>
          <Link href="/tests" className="btn-precision btn-secondary px-4 py-2 text-[13px] mt-2">View in library</Link>
        </div>
      ) : (
        <div className="px-6 py-6 space-y-5">
          {/* Mode toggle */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-2 uppercase tracking-wide">Mode</label>
            <div className="flex rounded-[6px] border border-border/40 overflow-hidden text-[12px] w-fit">
              {(["autonomous", "deterministic"] as const).map(m => (
                <button
                  key={m}
                  disabled={!editing}
                  onClick={() => setDraft(p => ({
                    ...p, mode: m,
                    ...(m === "autonomous" ? { steps: undefined, selfHealing: undefined } : { goal: undefined, expectedOutcome: undefined, runnerMode: undefined, maxSteps: undefined }),
                  }))}
                  className={cn(
                    "px-3 py-1.5 capitalize transition-colors",
                    draft.mode === m ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground",
                    !editing && "cursor-default"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Shared fields */}
          {([
            { label: "Name", key: "name" as const },
            { label: "Project", key: "project" as const },
            { label: "Environment", key: "environment" as const },
            { label: "Entry Point", key: "entryPoint" as const },
            { label: "Auth", key: "auth" as const },
          ]).map(f => (
            <div key={f.key}>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1.5 uppercase tracking-wide">{f.label}</label>
              {editing ? (
                <input
                  value={(draft[f.key] as string) ?? ""}
                  onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-muted/30 border border-border/40 rounded-[6px] px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-accent/40"
                />
              ) : (
                <p className="text-[13px] text-foreground">{(draft[f.key] as string) || <span className="text-muted-foreground/50">—</span>}</p>
              )}
            </div>
          ))}

          {/* Autonomous fields */}
          {draft.mode === "autonomous" && (
            <>
              {([
                { label: "Goal", key: "goal" as const },
                { label: "Expected Outcome", key: "expectedOutcome" as const },
              ]).map(f => (
                <div key={f.key}>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1.5 uppercase tracking-wide">{f.label}</label>
                  {editing ? (
                    <textarea
                      value={(draft[f.key] as string) ?? ""}
                      onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))}
                      rows={3}
                      className="w-full bg-muted/30 border border-border/40 rounded-[6px] px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-accent/40 resize-none"
                    />
                  ) : (
                    <p className="text-[13px] text-foreground leading-relaxed">{(draft[f.key] as string) || <span className="text-muted-foreground/50">—</span>}</p>
                  )}
                </div>
              ))}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-2 uppercase tracking-wide">Runner Mode</label>
                <div className="flex gap-2">
                  {(["fast", "standard", "deep"] as const).map(rm => (
                    <button
                      key={rm}
                      disabled={!editing}
                      onClick={() => editing && setDraft(p => ({ ...p, runnerMode: rm }))}
                      className={cn(
                        "px-3 py-1.5 rounded-[6px] text-[12px] border transition-colors capitalize",
                        draft.runnerMode === rm ? "bg-accent/10 border-accent/30 text-accent font-medium" : "border-border/40 text-muted-foreground hover:text-foreground",
                        !editing && "cursor-default"
                      )}
                    >
                      {rm}
                    </button>
                  ))}
                </div>
              </div>
              {(editing || draft.maxSteps) && (
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1.5 uppercase tracking-wide">Max Steps</label>
                  {editing ? (
                    <input
                      type="number"
                      value={draft.maxSteps ?? ""}
                      onChange={e => setDraft(p => ({ ...p, maxSteps: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-24 bg-muted/30 border border-border/40 rounded-[6px] px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-accent/40"
                      placeholder="25"
                    />
                  ) : (
                    <p className="text-[13px] text-foreground">{draft.maxSteps ?? "25 (default)"}</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Deterministic fields */}
          {draft.mode === "deterministic" && (
            <>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-2 uppercase tracking-wide">Self-Healing</label>
                <button
                  disabled={!editing}
                  onClick={() => editing && setDraft(p => ({ ...p, selfHealing: !p.selfHealing }))}
                  className={cn("flex items-center gap-2 text-[13px]", !editing && "cursor-default")}
                >
                  <span className={cn(
                    "w-8 h-[18px] rounded-full transition-colors relative flex items-center",
                    draft.selfHealing !== false ? "bg-accent" : "bg-muted"
                  )}>
                    <span className={cn(
                      "absolute w-3.5 h-3.5 rounded-full bg-white transition-transform",
                      draft.selfHealing !== false ? "translate-x-4" : "translate-x-0.5"
                    )} />
                  </span>
                  <span className="text-muted-foreground">{draft.selfHealing !== false ? "Enabled" : "Disabled"}</span>
                </button>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-2 uppercase tracking-wide">
                  Steps ({draft.steps?.length ?? 0})
                </label>
                <div className="space-y-1.5">
                  {(draft.steps ?? []).map((step, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-2 px-3 rounded-[6px] bg-muted/30 border border-border/30 group">
                      <span className="w-5 h-5 flex items-center justify-center rounded-[4px] bg-muted border border-border/50 text-[10px] font-mono text-muted-foreground shrink-0">
                        {i + 1}
                      </span>
                      {editing ? (
                        <input
                          value={step}
                          onChange={e => setDraft(p => ({ ...p, steps: p.steps?.map((s, j) => j === i ? e.target.value : s) }))}
                          className="flex-1 bg-transparent text-[12.5px] text-foreground focus:outline-none"
                        />
                      ) : (
                        <span className="text-[12.5px] text-foreground flex-1">{step}</span>
                      )}
                      {editing && (
                        <button
                          onClick={() => setDraft(p => ({ ...p, steps: p.steps?.filter((_, j) => j !== i) }))}
                          className="text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {editing && (
                    <button
                      onClick={() => setDraft(p => ({ ...p, steps: [...(p.steps ?? []), ""] }))}
                      className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground px-3 py-2 border border-dashed border-border/40 rounded-[6px] w-full hover:border-border/70 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add step
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </ArtifactShell>
  );
}

// ── Suite Draft panel ────────────────────────────────────

const RETRY_LABELS: Record<SuiteDraftData["retryPolicy"], string> = {
  none: "Don't retry",
  once: "Retry once",
  up_to_3: "Retry up to 3 times",
};

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={cn("w-8 h-[18px] rounded-full transition-colors flex items-center px-0.5 shrink-0", on ? "bg-accent" : "bg-muted/60")}>
      <span className={cn("w-3.5 h-3.5 rounded-full bg-white shadow transition-transform", on ? "translate-x-3.5" : "translate-x-0")} />
    </button>
  );
}

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FREQ_OPTIONS: { value: NonNullable<SuiteDraftData["scheduleFrequency"]>; label: string }[] = [
  { value: "daily",    label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly",   label: "Weekly" },
  { value: "monthly",  label: "Monthly" },
  { value: "custom",   label: "Custom cron" },
];

function deriveCron(d: SuiteDraftData): string {
  const [h, m] = (d.scheduleTime || "02:00").split(":").map(Number);
  switch (d.scheduleFrequency ?? "daily") {
    case "daily":    return `${m} ${h} * * *`;
    case "weekdays": return `${m} ${h} * * 1-5`;
    case "weekly":   return `${m} ${h} * * ${d.scheduleWeekDay ?? 1}`;
    case "monthly":  return `${m} ${h} ${d.scheduleMonthDay ?? 1} * *`;
    default:         return d.scheduleCron || "0 2 * * *";
  }
}

function ScheduleBuilder({ draft, setDraft, editing }: { draft: SuiteDraftData; setDraft: (fn: (p: SuiteDraftData) => SuiteDraftData) => void; editing: boolean }) {
  return (
    <div className="space-y-3 pt-1">
      {/* Frequency selector */}
      <div>
        <label className="text-[10.5px] font-medium text-muted-foreground block mb-1.5">Frequency</label>
        <div className="flex flex-wrap gap-1.5">
          {FREQ_OPTIONS.map(f => (
            <button
              key={f.value}
              onClick={() => editing && setDraft(p => ({ ...p, scheduleFrequency: f.value }))}
              className={cn(
                "px-2.5 py-1 rounded-[5px] text-[11.5px] transition-colors border",
                (draft.scheduleFrequency ?? "daily") === f.value
                  ? "bg-accent/10 border-accent/40 text-accent font-medium"
                  : "border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60",
                !editing && "cursor-default"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Time picker (shown for all except custom) */}
      {draft.scheduleFrequency !== "custom" && (
        <div>
          <label className="text-[10.5px] font-medium text-muted-foreground block mb-1.5">Time (UTC)</label>
          {editing ? (
            <input
              type="time"
              value={draft.scheduleTime || "02:00"}
              onChange={e => setDraft(p => ({ ...p, scheduleTime: e.target.value }))}
              className="bg-transparent border border-border/60 rounded-[6px] px-2.5 py-1.5 text-[12px] text-foreground focus:outline-none focus:border-primary transition-colors"
            />
          ) : (
            <span className="text-[12.5px] text-foreground">{draft.scheduleTime || "02:00"} UTC</span>
          )}
        </div>
      )}

      {/* Day-of-week picker for weekly */}
      {draft.scheduleFrequency === "weekly" && (
        <div>
          <label className="text-[10.5px] font-medium text-muted-foreground block mb-1.5">Day of week</label>
          <div className="flex gap-1">
            {DAYS_SHORT.map((d, i) => (
              <button
                key={d}
                onClick={() => editing && setDraft(p => ({ ...p, scheduleWeekDay: i }))}
                className={cn(
                  "w-8 h-8 rounded-[5px] text-[11px] font-medium transition-colors border",
                  draft.scheduleWeekDay === i
                    ? "bg-accent/10 border-accent/40 text-accent"
                    : "border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60",
                  !editing && "cursor-default"
                )}
              >
                {d.slice(0, 2)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day-of-month picker for monthly */}
      {draft.scheduleFrequency === "monthly" && (
        <div>
          <label className="text-[10.5px] font-medium text-muted-foreground block mb-1.5">Day of month</label>
          {editing ? (
            <input
              type="number"
              min={1}
              max={31}
              value={draft.scheduleMonthDay || 1}
              onChange={e => setDraft(p => ({ ...p, scheduleMonthDay: Number(e.target.value) }))}
              className="w-20 bg-transparent border border-border/60 rounded-[6px] px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-primary"
            />
          ) : (
            <span className="text-[12.5px] text-foreground">Day {draft.scheduleMonthDay || 1}</span>
          )}
        </div>
      )}

      {/* Custom cron */}
      {draft.scheduleFrequency === "custom" && (
        <div>
          <label className="text-[10.5px] font-medium text-muted-foreground block mb-1.5">Cron expression</label>
          {editing ? (
            <input
              value={draft.scheduleCron || "0 2 * * *"}
              onChange={e => setDraft(p => ({ ...p, scheduleCron: e.target.value }))}
              placeholder="0 2 * * *"
              className="w-full font-mono bg-transparent border border-border/60 rounded-[6px] px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-primary"
            />
          ) : (
            <code className="text-[11.5px] font-mono text-foreground bg-muted/40 px-2 py-1 rounded-[4px]">{draft.scheduleCron || "0 2 * * *"}</code>
          )}
        </div>
      )}

      {/* Derived cron preview */}
      {draft.scheduleFrequency !== "custom" && (
        <p className="text-[10.5px] text-muted-foreground/50">
          Cron: <code className="font-mono">{deriveCron(draft)}</code>
        </p>
      )}
    </div>
  );
}

function SuiteDraftPanel({ data, onClose, width, dragRef }: { data: SuiteDraftData; onClose: () => void; width: number; dragRef: React.RefObject<HTMLDivElement> }) {
  const [draft, setDraft] = useState<SuiteDraftData>({
    scheduleFrequency: "daily",
    scheduleTime: "02:00",
    scheduleWeekDay: 1,
    scheduleMonthDay: 1,
    scheduleCron: "0 2 * * *",
    ...data,
    tests: [...data.tests],
  });
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [expandedTrigger, setExpandedTrigger] = useState<string | null>(null);
  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);

  const handleSort = () => {
    if (dragItemRef.current === null || dragOverRef.current === null) return;
    const arr = [...draft.tests];
    const [item] = arr.splice(dragItemRef.current, 1);
    arr.splice(dragOverRef.current, 0, item);
    dragItemRef.current = null;
    dragOverRef.current = null;
    setDraft(p => ({ ...p, tests: arr }));
  };

  const Row = ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-border/25 last:border-0">
      <span className="text-[12.5px] text-foreground">{label}</span>
      {children}
    </div>
  );

  const TriggerSection = ({ id, icon, label, children }: { id: string; icon: React.ReactNode; label: string; children: React.ReactNode }) => (
    <div className="rounded-[6px] border border-border/30 overflow-hidden">
      <button
        onClick={() => setExpandedTrigger(expandedTrigger === id ? null : id)}
        className="flex items-center justify-between w-full px-3 py-2.5 text-left hover:bg-muted/20 transition-colors"
      >
        <span className="flex items-center gap-2 text-[12.5px] text-foreground">
          {icon}
          {label}
        </span>
        <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", expandedTrigger === id && "rotate-90")} />
      </button>
      {expandedTrigger === id && (
        <div className="px-3 pb-3 pt-0 border-t border-border/25">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <ArtifactShell title={draft.name} badge="Suite" badgeIcon={<Layers className="w-3 h-3" />}
      canEdit={!saved} editing={editing} onEdit={() => setEditing(v => !v)}
      onClose={onClose} width={width} dragRef={dragRef}
      footer={!saved ? (
        <>
          <button onClick={onClose} className="btn-precision btn-secondary flex-1 text-[12px] py-1.5">Discard</button>
          <button onClick={() => setSaved(true)} className="btn-precision px-3 py-1.5 text-[12px] bg-foreground/80 dark:bg-white/[0.04] text-background dark:text-foreground dark:border dark:border-white/[0.12] dark:hover:bg-white/[0.08] dark:hover:border-white/[0.2] rounded-[6px] hover:bg-foreground transition-colors flex-1">Save suite</button>
        </>
      ) : undefined}
    >
      {saved ? (
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center h-full">
          <div className="w-10 h-10 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
            <Check className="w-5 h-5 text-[#16a34a]" />
          </div>
          <p className="text-[14px] font-semibold text-foreground">Suite saved</p>
          <p className="text-[12px] text-muted-foreground">Ready to run from the Suites page</p>
          <Link href="/suites" className="btn-precision btn-secondary px-4 py-2 text-[13px] mt-2">View suites</Link>
        </div>
      ) : (
        <div className="px-5 py-5 space-y-6">

          {/* Suite name */}
          <Field label="Suite name">
            {editing
              ? <input value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} className="w-full bg-transparent border border-border/60 rounded-[6px] px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary transition-colors" />
              : <p className="text-[13px] text-foreground font-medium">{draft.name}</p>
            }
          </Field>

          {/* Execution mode toggle */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-2">Execution order</label>
            <div className="flex rounded-[6px] border border-border/40 overflow-hidden text-[12px] w-fit">
              {[
                { value: true,  label: "Parallel" },
                { value: false, label: "In order" },
              ].map(o => (
                <button
                  key={String(o.value)}
                  onClick={() => editing && setDraft(p => ({ ...p, parallel: o.value }))}
                  className={cn(
                    "px-3 py-1.5 transition-colors",
                    draft.parallel === o.value ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground",
                    !editing && "cursor-default"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {draft.parallel && <p className="text-[11px] text-muted-foreground/60 mt-1.5">Tests run concurrently — faster but uses more resources.</p>}
            {!draft.parallel && <p className="text-[11px] text-muted-foreground/60 mt-1.5">Tests run sequentially. Drag to reorder.</p>}
          </div>

          {/* Tests list */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-2">
              Tests ({draft.tests.length})
            </label>
            <div className="space-y-1.5">
              {draft.tests.length === 0 && (
                <p className="text-[12px] text-muted-foreground/50 italic px-1">No tests added</p>
              )}
              {draft.tests.map((t, i) => (
                <div
                  key={t.id}
                  draggable={!draft.parallel && editing}
                  onDragStart={() => { dragItemRef.current = i; }}
                  onDragEnter={() => { dragOverRef.current = i; }}
                  onDragEnd={handleSort}
                  onDragOver={e => e.preventDefault()}
                  className={cn(
                    "flex items-center gap-2.5 py-2 px-3 rounded-[6px] bg-muted/30 border border-border/30 group",
                    !draft.parallel && editing && "cursor-grab active:cursor-grabbing hover:border-accent/30 hover:bg-accent/5 transition-colors"
                  )}
                >
                  {/* Drag handle (sequential mode) */}
                  {!draft.parallel && editing && (
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  )}
                  {/* Number badge (sequential mode) */}
                  {!draft.parallel && (
                    <span className="w-5 h-5 flex items-center justify-center rounded-[4px] bg-muted border border-border text-[10px] font-mono text-muted-foreground shrink-0">
                      {i + 1}
                    </span>
                  )}
                  <span className="text-[12.5px] text-foreground flex-1 min-w-0 truncate">{t.name}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0",
                    t.mode === "autonomous" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"
                  )}>
                    {t.mode === "autonomous" ? "Auto" : "Det"}
                  </span>
                  {editing && (
                    <button
                      onClick={() => setDraft(p => ({ ...p, tests: p.tests.filter((_, j) => j !== i) }))}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0 ml-1 opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Concurrency + retry */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Execution</p>
            <div className="rounded-[6px] border border-border/30 px-3 divide-y divide-border/20">
              {draft.parallel && (
                <Row label="Max concurrency">
                  {editing
                    ? <input type="number" min={1} max={20} value={draft.maxConcurrency} onChange={e => setDraft(p => ({ ...p, maxConcurrency: Number(e.target.value) }))} className="w-16 text-right bg-transparent border border-border/60 rounded-[4px] px-2 py-1 text-[12px] focus:outline-none focus:border-primary" />
                    : <span className="text-[12.5px] text-foreground">{draft.maxConcurrency}</span>
                  }
                </Row>
              )}
              <Row label={<span className="flex items-center gap-2"><RotateCcw className="w-3.5 h-3.5 text-muted-foreground/60" />Retry failed tests</span>}>
                {editing ? (
                  <select value={draft.retryPolicy} onChange={e => setDraft(p => ({ ...p, retryPolicy: e.target.value as SuiteDraftData["retryPolicy"] }))} className="text-[12px] bg-muted/40 border border-border/40 rounded-[4px] px-2 py-1 focus:outline-none">
                    <option value="none">Don't retry</option>
                    <option value="once">Retry once</option>
                    <option value="up_to_3">Retry up to 3 times</option>
                  </select>
                ) : (
                  <span className="text-[12.5px] text-foreground">{RETRY_LABELS[draft.retryPolicy]}</span>
                )}
              </Row>
            </div>
          </div>

          {/* Triggers */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Triggers</p>

            <TriggerSection id="schedule" icon={<Clock className="w-3.5 h-3.5 text-muted-foreground/60" />} label="Schedule">
              <div className="mt-2">
                <Toggle on={draft.triggerScheduled} onChange={v => editing && setDraft(p => ({ ...p, triggerScheduled: v }))} />
                {draft.triggerScheduled && (
                  <div className="mt-3">
                    <ScheduleBuilder draft={draft} setDraft={setDraft} editing={editing} />
                  </div>
                )}
              </div>
            </TriggerSection>

            <TriggerSection id="pr" icon={<GitPullRequest className="w-3.5 h-3.5 text-muted-foreground/60" />} label="Pull requests">
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground">Run on every PR opened/updated</span>
                <Toggle on={draft.triggerOnPr} onChange={v => editing && setDraft(p => ({ ...p, triggerOnPr: v }))} />
              </div>
            </TriggerSection>

            <TriggerSection id="webhook" icon={<Zap className="w-3.5 h-3.5 text-muted-foreground/60" />} label="Webhook">
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">Enable webhook trigger</span>
                  <Toggle on={draft.triggerWebhook} onChange={v => editing && setDraft(p => ({ ...p, triggerWebhook: v }))} />
                </div>
                {draft.triggerWebhook && (
                  <div className="bg-muted/30 rounded-[5px] border border-border/30 px-2.5 py-2 font-mono text-[10.5px] text-muted-foreground break-all">
                    POST https://api.traceback.io/webhooks/suite/&lt;id&gt;
                  </div>
                )}
              </div>
            </TriggerSection>
          </div>
        </div>
      )}
    </ArtifactShell>
  );
}

// ── Run Report panel ─────────────────────────────────────

const STATUS_CONFIG = {
  passed:  { label: "Passed",  cls: "text-[#16a34a] bg-[#16a34a]/10" },
  failed:  { label: "Failed",  cls: "text-[#dc2626] bg-[#dc2626]/10" },
  healed:  { label: "Healed",  cls: "text-[#ca8a04] bg-[#ca8a04]/10" },
  blocked: { label: "Blocked", cls: "text-muted-foreground bg-muted/40" },
  running: { label: "Running", cls: "text-accent bg-accent/10" },
};

function RunReportPanel({ data, onClose, width, dragRef }: { data: RunReportData; onClose: () => void; width: number; dragRef: React.RefObject<HTMLDivElement> }) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const s = STATUS_CONFIG[data.status];

  return (
    <ArtifactShell title={data.testName} badge="Run" badgeIcon={<Play className="w-3 h-3" />}
      onClose={onClose} width={width} dragRef={dragRef}
      footer={
        <Link href={data.href} className="btn-precision btn-secondary w-full text-[12px] py-1.5 text-center">
          View full report
        </Link>
      }
    >
      <div className="px-6 py-5 space-y-5">
        {/* Status + meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", s.cls)}>{s.label}</span>
          {data.branch && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <GitPullRequest className="w-3 h-3" />{data.branch}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
            <Clock className="w-3 h-3" />{data.duration}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Environment", value: data.environment },
            { label: "Screenshots", value: String(data.screenshotCount) },
            { label: "Issues",      value: String(data.issueCount) },
          ].map(s => (
            <div key={s.label} className="bg-muted/30 rounded-[6px] px-3 py-2">
              <p className="text-[10px] text-muted-foreground mb-0.5">{s.label}</p>
              <p className="text-[13px] font-semibold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Key finding */}
        {data.keyFinding && (
          <Field label="Key finding">
            <p className="text-[13px] text-foreground leading-relaxed">{data.keyFinding}</p>
          </Field>
        )}

        {/* Activity log */}
        {data.steps.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Activity log</p>
            <div className="space-y-1">
              {data.steps.map(step => (
                <div key={step.step} className={cn("rounded-[6px] border transition-colors", step.isError ? "border-[#dc2626]/20 bg-[#dc2626]/5" : "border-border/30 bg-muted/20")}>
                  <button onClick={() => setExpandedStep(expandedStep === step.step ? null : step.step)} className="flex items-center gap-2.5 w-full px-3 py-2 text-left">
                    <span className="text-[10px] tabular-nums text-muted-foreground/50 w-5 shrink-0">{step.step}</span>
                    <Terminal className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-[12px] text-foreground flex-1 truncate">{step.thought}</span>
                    <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0", expandedStep === step.step && "rotate-90")} />
                  </button>
                  {expandedStep === step.step && (
                    <div className="px-3 pb-2.5 pt-0 pl-10">
                      <code className="text-[11px] text-muted-foreground font-mono break-all">{step.action}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ArtifactShell>
  );
}

// ── Issue Detail panel ───────────────────────────────────

const SEV_CONFIG = {
  critical: { label: "Critical", cls: "text-[#dc2626] bg-[#dc2626]/10", Icon: XCircle },
  high:     { label: "High",     cls: "text-[#ca8a04] bg-[#ca8a04]/10", Icon: TriangleAlert },
  warning:  { label: "Warning",  cls: "text-[#ca8a04] bg-[#ca8a04]/8",  Icon: AlertCircle },
  info:     { label: "Info",     cls: "text-accent bg-accent/10",        Icon: Info },
};

function IssueDetailPanel({ data, onClose, width, dragRef }: { data: IssueDetailData; onClose: () => void; width: number; dragRef: React.RefObject<HTMLDivElement> }) {
  const [status, setStatus] = useState(data.status);
  const sev = SEV_CONFIG[data.severity];

  return (
    <ArtifactShell title={data.title} badge="Issue" badgeIcon={<AlertCircle className="w-3 h-3" />}
      onClose={onClose} width={width} dragRef={dragRef}
      footer={
        status === "open" ? (
          <>
            <button onClick={() => setStatus("dismissed")} className="btn-precision btn-secondary flex-1 text-[12px] py-1.5">Dismiss</button>
            <button onClick={() => setStatus("pushed")} className="btn-precision px-3 py-1.5 text-[12px] bg-foreground/80 dark:bg-white/[0.04] text-background dark:text-foreground dark:border dark:border-white/[0.12] dark:hover:bg-white/[0.08] dark:hover:border-white/[0.2] rounded-[6px] hover:bg-foreground transition-colors flex-1">Push to GitHub</button>
          </>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <Check className="w-3.5 h-3.5 text-[#16a34a]" />
            <span className="text-[12px] text-muted-foreground capitalize">{status}</span>
            <Link href={data.href} className="ml-auto text-[12px] text-accent hover:text-accent/80 transition-colors">View issue</Link>
          </div>
        )
      }
    >
      <div className="px-6 py-5 space-y-5">
        {/* Severity + id */}
        <div className="flex items-center gap-2">
          <span className={cn("flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", sev.cls)}>
            <sev.Icon className="w-3 h-3" />{sev.label}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">{data.issueId}</span>
        </div>

        {/* Meta */}
        <div className="divide-y divide-border/30 rounded-[6px] border border-border/30 overflow-hidden">
          {[
            { label: "Flow",    value: data.flow },
            { label: "Context", value: data.context },
            { label: "Test",    value: data.testName },
          ].map(r => (
            <div key={r.label} className="flex gap-4 px-3 py-2">
              <span className="text-[11px] text-muted-foreground w-[70px] shrink-0 pt-px">{r.label}</span>
              <span className="text-[12px] text-foreground">{r.value}</span>
            </div>
          ))}
        </div>

        {/* Evidence */}
        <Field label="Evidence">
          <p className="text-[12.5px] text-foreground leading-relaxed">{data.evidence}</p>
        </Field>

        {/* Proposed solution */}
        {data.proposedSolution && (
          <Field label="Proposed solution">
            <div className="bg-[#16a34a]/5 border border-[#16a34a]/20 rounded-[6px] px-3 py-2.5">
              <p className="text-[12.5px] text-foreground leading-relaxed">{data.proposedSolution}</p>
            </div>
          </Field>
        )}

        {/* Run link */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted-foreground">From run</span>
          <Link href={`/runs/${data.runId}`} className="text-[12px] text-accent hover:text-accent/80 transition-colors flex items-center gap-1">
            {data.runId.slice(0, 8)} <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </ArtifactShell>
  );
}

// ── Test Detail panel ────────────────────────────────────

const TEST_STATUS_CONFIG = {
  pass:      { label: "Passing", cls: "text-[#16a34a] bg-[#16a34a]/10" },
  fail:      { label: "Failing", cls: "text-[#dc2626] bg-[#dc2626]/10" },
  never_run: { label: "Never run", cls: "text-muted-foreground bg-muted/40" },
};

function TestDetailPanel({ data, onClose, width, dragRef }: { data: TestDetailData; onClose: () => void; width: number; dragRef: React.RefObject<HTMLDivElement> }) {
  const s = TEST_STATUS_CONFIG[data.status];

  return (
    <ArtifactShell title={data.name} badge="Test" badgeIcon={<ListChecks className="w-3 h-3" />}
      onClose={onClose} width={width} dragRef={dragRef}
      footer={
        <div className="flex gap-2 w-full">
          <Link href={data.href} className="btn-precision btn-secondary flex-1 text-[12px] py-1.5 text-center">View in library</Link>
          <button className="btn-precision px-3 py-1.5 text-[12px] bg-foreground/80 dark:bg-white/[0.04] text-background dark:text-foreground dark:border dark:border-white/[0.12] dark:hover:bg-white/[0.08] dark:hover:border-white/[0.2] rounded-[6px] hover:bg-foreground transition-colors flex-1 flex items-center justify-center gap-1.5">
            <Play className="w-3 h-3" /> Run test
          </button>
        </div>
      }
    >
      <div className="px-6 py-5 space-y-5">
        {/* Status + mode */}
        <div className="flex items-center gap-2">
          <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", s.cls)}>{s.label}</span>
          <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", data.mode === "autonomous" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground")}>
            {data.mode === "autonomous" ? "Autonomous" : "Deterministic"}
          </span>
        </div>

        {/* Fields */}
        <div className="divide-y divide-border/30 rounded-[6px] border border-border/30 overflow-hidden">
          {[
            { label: "Environment", value: data.environment },
            { label: "Entry point", value: data.entryPoint },
            { label: "Last run",    value: data.lastRunAt || "Never" },
            { label: "Est. credits", value: String(data.estimatedCredits) },
            ...(data.stepCount !== undefined ? [{ label: "Steps", value: String(data.stepCount) }] : []),
          ].map(r => (
            <div key={r.label} className="flex gap-4 px-3 py-2">
              <span className="text-[11px] text-muted-foreground w-[90px] shrink-0 pt-px">{r.label}</span>
              <span className="text-[12px] text-foreground">{r.value}</span>
            </div>
          ))}
        </div>

        {/* Goal */}
        {data.goal && (
          <Field label="Goal">
            <p className="text-[13px] text-foreground leading-relaxed">{data.goal}</p>
          </Field>
        )}
      </div>
    </ArtifactShell>
  );
}

// ── Dispatcher ───────────────────────────────────────────

function ArtifactPanel({ artifact, onClose, width, onWidthChange }: ArtifactPanelProps) {
  const dragRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = dragRef.current;
    if (!handle) return;
    let startX = 0, startW = 0;
    const onDown = (e: MouseEvent) => { startX = e.clientX; startW = width; document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp); };
    const onMove = (e: MouseEvent) => { onWidthChange(Math.max(300, Math.min(700, startW + (startX - e.clientX)))); };
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    handle.addEventListener("mousedown", onDown);
    return () => handle.removeEventListener("mousedown", onDown);
  }, [width, onWidthChange]);

  const shared = { onClose, width, dragRef: dragRef as React.RefObject<HTMLDivElement> };

  if (artifact.type === "test_draft")   return <TestDraftPanel   data={artifact.data} {...shared} />;
  if (artifact.type === "suite_draft")  return <SuiteDraftPanel  data={artifact.data} {...shared} />;
  if (artifact.type === "run_report")   return <RunReportPanel   data={artifact.data} {...shared} />;
  if (artifact.type === "issue_detail") return <IssueDetailPanel data={artifact.data} {...shared} />;
  if (artifact.type === "test_detail")  return <TestDetailPanel  data={artifact.data} {...shared} />;
  return null;
}

// ─── Composer ────────────────────────────────────────────

const ACTIONS: { value: ActionType; hint: string }[] = [
  { value: "Auto",        hint: "Let the agent decide" },
  { value: "Ask",         hint: "Get an answer" },
  { value: "Run",         hint: "Execute a test or flow" },
  { value: "Create Test", hint: "Draft a new test" },
  { value: "Open",        hint: "Navigate to an object" },
  { value: "Visualize",   hint: "Render workspace data" },
];

const SLASH_ACTIONS = [
  { cmd: "/run",       action: "Run" as ActionType,         hint: "Trigger a test run" },
  { cmd: "/test",      action: "Create Test" as ActionType, hint: "Draft a new test" },
  { cmd: "/visualize", action: "Visualize" as ActionType,   hint: "Render data in chat" },
];

interface ComposerProps {
  onSend: (content: string, action: ActionType, meta: { autonomyPreset: string; model: string; pageContexts?: string[] }) => void;
  autoFocus?: boolean;
  fillRef?: React.MutableRefObject<((v: string) => void) | null>;
  slashDown?: boolean;
  pageContextLabel?: string | null;
  onDismissContext?: () => void;
  isStreaming?: boolean;
}

type ModelMode = "Thinking" | "Fast";
type AskMode = "Auto" | "Approval" | "Plan";
const ASK_MODE_HINTS: Record<AskMode, string> = {
  "Auto":     "Executes actions independently",
  "Approval": "Asks before each action",
  "Plan":     "Shows a plan first, then acts",
};

type AtEntityType = 'run' | 'issue' | 'test' | 'suite';
interface AtResult { type: AtEntityType; id: string; displayLabel: string; subLabel: string; raw: any; }

export function OperatorComposer({ onSend, autoFocus, fillRef, slashDown, pageContextLabel, onDismissContext, isStreaming }: ComposerProps) {
  const [value, setValue] = useState("");
  const [action, setAction] = useState<ActionType>("Auto");
  const [model, setModel] = useState<ModelMode>("Fast");
  const [askMode, setAskMode] = useState<AskMode>(() => {
    try { return (localStorage.getItem("operator-ask-mode") as AskMode) || "Auto"; } catch { return "Auto"; }
  });
  const [skills, setSkills] = useState<any[]>([]);
  const [linkedContexts, setLinkedContexts] = useState<{ label: string; context: string }[]>([]);
  const [atSearch, setAtSearch] = useState<{ query: string; results: AtResult[]; anchor: number } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const atTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ASK_MODE_MAP: Record<AskMode, string> = {
    Auto:     "autonomous",
    Approval: "supervised",
    Plan:     "plan",
  };
  const MODEL_MAP: Record<ModelMode, string> = {
    Thinking: "o3-mini",
    Fast:     "gpt-4o",
  };

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  useEffect(() => { if (fillRef) fillRef.current = (v: string) => { setValue(v); ref.current?.focus(); }; });
  useEffect(() => { operatorApi.getSkills().then(setSkills).catch(() => {}); }, []);

  const fetchAtResults = (q: string) => {
    if (atTimerRef.current) clearTimeout(atTimerRef.current);
    atTimerRef.current = setTimeout(async () => {
      const results: AtResult[] = [];
      try {
        const [runsR, issuesR, testsR, suitesR] = await Promise.all([
          runsApi.list({ q }).catch(() => ({ items: [] as any[] })),
          issuesApi.list({ q, status: 'all' }).catch(() => ({ items: [] as any[] })),
          testsApi.list({ q }).catch(() => ({ items: [] as any[] })),
          suitesApi.list({ q }).catch(() => ({ items: [] as any[] })),
        ]);
        runsR.items.slice(0, 3).forEach((i: any) => results.push({ type: 'run', id: i.id, raw: i, displayLabel: i.testName, subLabel: i.status }));
        issuesR.items.slice(0, 3).forEach((i: any) => results.push({ type: 'issue', id: i.id, raw: i, displayLabel: i.title, subLabel: i.id }));
        testsR.items.slice(0, 3).forEach((i: any) => results.push({ type: 'test', id: i.id, raw: i, displayLabel: i.name, subLabel: i.mode }));
        suitesR.items.slice(0, 2).forEach((i: any) => results.push({ type: 'suite', id: i.id, raw: i, displayLabel: i.name, subLabel: '' }));
      } catch { /* ignore */ }
      setAtSearch(prev => prev ? { ...prev, results } : null);
    }, 150);
  };

  const addLinkedContext = (item: AtResult) => {
    let label = '', context = '';
    if (item.type === 'run') {
      label = `Run: ${item.raw.testName}`;
      context = `Linked run "${item.raw.testName}" (${item.id}) — status: ${item.raw.status}, env: ${item.raw.environment}`;
    } else if (item.type === 'issue') {
      label = `${item.id}: ${item.raw.title}`;
      context = `Linked issue ${item.id} "${item.raw.title}" — ${item.raw.severity} severity, ${item.raw.status}`;
    } else if (item.type === 'test') {
      label = `Test: ${item.raw.name}`;
      context = `Linked test "${item.raw.name}" (${item.id}) — ${item.raw.mode} mode, status: ${item.raw.status}`;
    } else if (item.type === 'suite') {
      label = `Suite: ${item.raw.name}`;
      context = `Linked suite "${item.raw.name}" (${item.id})`;
    }
    setLinkedContexts(prev => [...prev, { label, context }]);
  };

  const selectAtResult = (item: AtResult) => {
    if (atSearch) {
      const before = value.slice(0, atSearch.anchor);
      const after = value.slice(atSearch.anchor + 1 + atSearch.query.length);
      setValue(before + after);
    }
    setAtSearch(null);
    addLinkedContext(item);
    setTimeout(() => ref.current?.focus(), 0);
  };

  // Slash menu detection
  const slashMenuOpen = value.startsWith('/') && !value.includes(' ') && value.length > 0;
  const slashFilter = slashMenuOpen ? value.slice(1).toLowerCase() : '';
  const matchesFilter = (name: string, trigger: string) =>
    !slashFilter || trigger.toLowerCase().startsWith(slashFilter) || name.toLowerCase().includes(slashFilter);
  const skillMatches = skills.filter(sk => matchesFilter(sk.name, sk.trigger));
  const actionMatches = SLASH_ACTIONS.filter(s => matchesFilter(s.cmd.slice(1), s.cmd.slice(1)));
  const hasSlashItems = skillMatches.length > 0 || actionMatches.length > 0;

  const handleChange = (v: string) => {
    setValue(v);
    // @ detection for entity linking
    const cursor = ref.current?.selectionStart ?? v.length;
    const before = v.slice(0, cursor);
    const atIdx = before.lastIndexOf('@');
    if (atIdx !== -1 && !before.slice(atIdx).includes(' ')) {
      const q = before.slice(atIdx + 1);
      setAtSearch(prev => ({ query: q, results: prev?.results ?? [], anchor: atIdx }));
      fetchAtResults(q);
    } else {
      setAtSearch(null);
    }
  };

  const handleSlash = (s: typeof SLASH_ACTIONS[number]) => {
    setValue(s.cmd + " ");
    setAction(s.action);
    ref.current?.focus();
  };

  const handleSkillSelect = (sk: any) => {
    setValue(sk.instruction);
    setAtSearch(null);
    ref.current?.focus();
  };

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value.trim(), action, {
      autonomyPreset: ASK_MODE_MAP[askMode],
      model: MODEL_MAP[model],
      pageContexts: linkedContexts.map(c => c.context),
    });
    setValue("");
    setLinkedContexts([]);
    setAtSearch(null);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setAtSearch(null); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="relative">
      {/* Unified slash command menu */}
      {slashMenuOpen && hasSlashItems && (
        <div className={cn(
          "absolute left-0 right-0 border border-border/60 rounded-[8px] bg-background shadow-lg overflow-y-auto custom-scrollbar z-10 max-h-[280px]",
          slashDown ? "top-full mt-1.5" : "bottom-full mb-1.5"
        )}>
          {skillMatches.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/30">Skills</div>
              {skillMatches.map((sk: any) => (
                <button
                  key={sk.id}
                  onMouseDown={e => { e.preventDefault(); handleSkillSelect(sk); }}
                  className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="text-accent shrink-0 text-[11px]">⚡</span>
                  <span className="text-[12px] font-mono text-foreground w-28 shrink-0">/{sk.trigger}</span>
                  <span className="text-[12px] text-muted-foreground">{sk.name}</span>
                </button>
              ))}
            </>
          )}
          {actionMatches.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/30 border-t border-t-border/20">Actions</div>
              {actionMatches.map(s => (
                <button
                  key={s.cmd}
                  onMouseDown={e => { e.preventDefault(); handleSlash(s); }}
                  className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="text-muted-foreground shrink-0 text-[11px]">▶</span>
                  <span className="text-[12px] font-mono text-foreground w-28 shrink-0">{s.cmd}</span>
                  <span className="text-[12px] text-muted-foreground">{s.hint}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* @ entity search menu */}
      {atSearch && (
        <div className={cn(
          "absolute left-0 right-0 border border-border/60 rounded-[8px] bg-background shadow-lg overflow-y-auto custom-scrollbar z-10 max-h-[240px]",
          slashDown ? "top-full mt-1.5" : "bottom-full mb-1.5"
        )}>
          {atSearch.results.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-muted-foreground">
              {atSearch.query.length === 0 ? "Type to search runs, tests, issues, suites…" : "No results"}
            </div>
          ) : (
            (['run', 'issue', 'test', 'suite'] as AtEntityType[]).map(type => {
              const group = atSearch.results.filter(r => r.type === type);
              if (group.length === 0) return null;
              const typeLabel = { run: 'Runs', issue: 'Issues', test: 'Tests', suite: 'Suites' }[type];
              return (
                <div key={type}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/30 sticky top-0 bg-background">
                    {typeLabel}
                  </div>
                  {group.map(item => (
                    <button
                      key={item.id}
                      onMouseDown={e => { e.preventDefault(); selectAtResult(item); }}
                      className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors border-b border-border/10 last:border-0"
                    >
                      <span className="text-[12px] text-foreground truncate flex-1">{item.displayLabel}</span>
                      {item.subLabel && <span className="text-[11px] text-muted-foreground shrink-0">{item.subLabel}</span>}
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="border border-border/60 rounded-[10px] overflow-hidden focus-within:border-border/80 transition-colors bg-background">
        {(pageContextLabel || linkedContexts.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5 pb-0">
            {pageContextLabel && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5">
                <span className="shrink-0 font-semibold">@</span>
                <span className="truncate max-w-[200px]">{pageContextLabel}</span>
                {onDismissContext && (
                  <button
                    onClick={onDismissContext}
                    className="shrink-0 ml-0.5 text-accent/50 hover:text-accent transition-colors"
                    title="Remove context"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            )}
            {linkedContexts.map((lc, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium text-accent bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5">
                <span className="shrink-0 font-semibold">@</span>
                <span className="truncate max-w-[160px]">{lc.label}</span>
                <button
                  onClick={() => setLinkedContexts(prev => prev.filter((_, j) => j !== i))}
                  className="shrink-0 ml-0.5 text-accent/50 hover:text-accent transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={ref}
          value={value}
          onChange={e => { handleChange(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 200) + "px"; }}
          onKeyDown={handleKey}
          placeholder="Give your agent a QA goal… or type / for commands"
          rows={3}
          style={{ minHeight: "72px", maxHeight: "200px" }}
          className="w-full resize-none px-4 pt-3 pb-1 text-[13px] bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          {/* Action selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border/50 rounded-[5px] px-2 py-0.5 transition-colors hover:border-border">
                {action} <ChevronDown className="w-2.5 h-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52 surface-subtle border-border" side="top" align="start">
              {ACTIONS.map(a => (
                <DropdownMenuItem key={a.value} onClick={() => setAction(a.value)} className="cursor-pointer flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px]">{a.value}</div>
                    <div className="text-[11px] text-muted-foreground">{a.hint}</div>
                  </div>
                  {action === a.value && <Check className="w-3.5 h-3.5 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Model toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border/50 rounded-[5px] px-2 py-0.5 transition-colors hover:border-border">
                {model} <ChevronDown className="w-2.5 h-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-36 surface-subtle border-border" side="top" align="start">
              {(["Thinking", "Fast"] as ModelMode[]).map(m => (
                <DropdownMenuItem key={m} onClick={() => setModel(m)} className="cursor-pointer flex items-center justify-between gap-3">
                  <span className="text-[13px]">{m}</span>
                  {model === m && <Check className="w-3.5 h-3.5 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Ask mode */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "flex items-center gap-1 text-[11px] font-medium border rounded-[5px] px-2 py-0.5 transition-colors",
                askMode !== "Approval"
                  ? "text-accent border-accent/40 bg-accent/10 hover:bg-accent/20"
                  : "text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
              )}>
                {askMode} <ChevronDown className="w-2.5 h-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 surface-subtle border-border" side="top" align="start">
              {(Object.keys(ASK_MODE_HINTS) as AskMode[]).map(m => (
                <DropdownMenuItem key={m} onClick={() => { setAskMode(m); try { localStorage.setItem("operator-ask-mode", m); } catch {} }} className="cursor-pointer flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px]">{m}</div>
                    <div className="text-[11px] text-muted-foreground">{ASK_MODE_HINTS[m]}</div>
                  </div>
                  {askMode === m && <Check className="w-3.5 h-3.5 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!value.trim() || isStreaming}
            className="ml-auto w-7 h-7 flex items-center justify-center rounded-[6px] bg-foreground dark:bg-white/[0.04] dark:border dark:border-white/[0.12] text-background dark:text-foreground disabled:opacity-40 hover:opacity-80 dark:hover:bg-white/[0.08] transition-opacity"
          >
            {isStreaming ? (
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <ArrowUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Settings panel ──────────────────────────────────────

type AutonomyPreset = "supervised" | "balanced" | "autonomous";

interface OperatorSettingsData {
  autonomyPreset: AutonomyPreset;
  responseFormat: number;  // 0=text-heavy  100=visual-heavy
  mockupFreq: number;      // 0=on request  100=proactively
  responseLength: number;  // 0=concise     100=detailed
  model: ModelMode;
  instructions: string;
  alwaysDo: string;
  neverDo: string;
}

const DEFAULT_SETTINGS: OperatorSettingsData = {
  autonomyPreset: "balanced",
  responseFormat: 40,
  mockupFreq: 50,
  responseLength: 50,
  model: "Fast",
  instructions: "",
  alwaysDo: "",
  neverDo: "",
};

function SliderRow({ label, lo, hi, value, onChange }: {
  label: string; lo: string; hi: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{value}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted/60">
        <div className="absolute left-0 top-0 h-full rounded-full bg-foreground/40 transition-all" style={{ width: `${value}%` }} />
        <input
          type="range" min={0} max={100} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground border-2 border-background shadow transition-all pointer-events-none"
          style={{ left: `calc(${value}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-muted-foreground">{lo}</span>
        <span className="text-[10px] text-muted-foreground">{hi}</span>
      </div>
    </div>
  );
}

function OperatorSettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [s, setS] = useState<OperatorSettingsData>({ ...DEFAULT_SETTINGS });
  const [saved, setSaved] = useState(false);
  const [skills, setSkills] = useState<any[]>([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillTrigger, setNewSkillTrigger] = useState('');
  const [newSkillInstruction, setNewSkillInstruction] = useState('');
  const set = <K extends keyof OperatorSettingsData>(k: K, v: OperatorSettingsData[K]) =>
    setS(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!open) return;
    operatorApi.getSettings().then(data => {
      setS({
        autonomyPreset: (data.autonomyPreset ?? 'balanced') as AutonomyPreset,
        responseFormat: data.responseFormat ?? 50,
        mockupFreq: data.mockupFreq ?? 50,
        responseLength: data.responseLength ?? 50,
        model: data.model === 'gpt-4o' ? 'Thinking' : 'Fast',
        instructions: data.instructions ?? '',
        alwaysDo: data.alwaysDo ?? '',
        neverDo: data.neverDo ?? '',
      });
    }).catch(() => {});
    operatorApi.getSkills().then(setSkills).catch(() => {});
  }, [open]);

  const handleSave = async () => {
    await operatorApi.updateSettings({
      autonomyPreset: s.autonomyPreset,
      responseFormat: s.responseFormat,
      mockupFreq: s.mockupFreq,
      responseLength: s.responseLength,
      model: s.model === 'Thinking' ? 'gpt-4o' : 'gpt-4o-mini',
      instructions: s.instructions,
      alwaysDo: s.alwaysDo,
      neverDo: s.neverDo,
    }).catch(() => {});
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  };

  const addSkill = async () => {
    if (!newSkillName.trim() || !newSkillTrigger.trim() || !newSkillInstruction.trim()) return;
    try {
      const skill = await operatorApi.createSkill({
        name: newSkillName.trim(),
        trigger: newSkillTrigger.trim().replace(/^\//, ''),
        instruction: newSkillInstruction.trim(),
      });
      setSkills(prev => [...prev, skill]);
      setNewSkillName(''); setNewSkillTrigger(''); setNewSkillInstruction('');
    } catch { /* ignore */ }
  };

  const removeSkill = async (id: string) => {
    try {
      await operatorApi.deleteSkill(id);
      setSkills(prev => prev.filter((sk: any) => sk.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/50 backdrop-blur-[3px] transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Modal */}
      <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-6", open ? "pointer-events-auto" : "pointer-events-none")}>
        <div
          className={cn(
            "w-full max-w-[680px] max-h-[88vh] bg-background border border-border/60 rounded-[14px] shadow-[0_8px_48px_rgba(0,0,0,0.14)] flex flex-col",
            "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
            open ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.97] translate-y-2"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Agent settings</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">How your agent works</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 space-y-5">
            {/* Autonomy — 3 horizontal cards */}
            <section>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Autonomy default</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "supervised",  label: "Supervised",  desc: "Asks before every action" },
                  { id: "balanced",    label: "Balanced",    desc: "Confirms key decisions only" },
                  { id: "autonomous",  label: "Autonomous",  desc: "Executes independently" },
                ] as { id: AutonomyPreset; label: string; desc: string }[]).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => set("autonomyPreset", opt.id)}
                    className={cn(
                      "flex flex-col gap-1.5 px-3 py-2.5 rounded-[8px] border text-left transition-colors",
                      s.autonomyPreset === opt.id
                        ? "border-border bg-muted/50 text-foreground"
                        : "border-border/40 text-muted-foreground hover:bg-muted/40 hover:border-border/70 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0 transition-colors", s.autonomyPreset === opt.id ? "bg-foreground" : "bg-muted-foreground/30")} />
                      <span className="text-[12px] font-medium">{opt.label}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground leading-snug pl-[14px]">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Two-column grid */}
            <div className="grid grid-cols-2 gap-5">
              {/* Left: Response preferences */}
              <section>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Response preferences</p>
                <div className="space-y-5">
                  <SliderRow label="Response format"    lo="Text-first"  hi="Visual-first"  value={s.responseFormat}  onChange={v => set("responseFormat", v)} />
                  <SliderRow label="Mockup suggestions" lo="On request"  hi="Proactively"   value={s.mockupFreq}      onChange={v => set("mockupFreq", v)} />
                  <SliderRow label="Response length"    lo="Concise"     hi="Detailed"      value={s.responseLength}  onChange={v => set("responseLength", v)} />
                </div>
              </section>

              {/* Right: Model + Instructions */}
              <div className="space-y-5">
                <section>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Default model</p>
                  <div className="flex gap-1.5">
                    {(["Fast", "Thinking"] as ModelMode[]).map(m => (
                      <button
                        key={m}
                        onClick={() => set("model", m)}
                        className={cn(
                          "flex-1 py-1.5 rounded-[6px] text-[12px] border transition-colors",
                          s.model === m
                            ? "bg-muted/60 border-border text-foreground font-medium"
                            : "border-border/40 text-muted-foreground hover:bg-muted/40 hover:border-border/70 hover:text-foreground"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">Thinking reasons more carefully for complex tasks.</p>
                </section>

                <section>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Instructions</p>
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">General</label>
                      <textarea value={s.instructions} onChange={e => set("instructions", e.target.value)} placeholder="Always reference the run ID when discussing failures…" rows={2} className="w-full resize-none bg-muted/20 border border-border/50 rounded-[6px] px-2.5 py-2 text-[12px] text-foreground focus:outline-none focus:border-border/80 transition-colors placeholder:text-muted-foreground/50" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Always do</label>
                      <textarea value={s.alwaysDo} onChange={e => set("alwaysDo", e.target.value)} placeholder="Show a run summary card for every run…" rows={2} className="w-full resize-none bg-muted/20 border border-border/50 rounded-[6px] px-2.5 py-2 text-[12px] text-foreground focus:outline-none focus:border-border/80 transition-colors placeholder:text-muted-foreground/50" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Never do</label>
                      <textarea value={s.neverDo} onChange={e => set("neverDo", e.target.value)} placeholder="Never run tests on production without confirmation…" rows={2} className="w-full resize-none bg-muted/20 border border-border/50 rounded-[6px] px-2.5 py-2 text-[12px] text-foreground focus:outline-none focus:border-border/80 transition-colors placeholder:text-muted-foreground/50" />
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Skills section */}
            <section>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Skills</p>
              <div className="space-y-1.5 mb-3">
                {skills.map((sk: any) => (
                  <div key={sk.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] bg-muted/20 border border-border/30">
                    <span className="text-[10px] font-mono text-accent shrink-0">/{sk.trigger}</span>
                    <span className="text-[12px] text-foreground flex-1 truncate">{sk.name}</span>
                    {!sk.isBuiltin && (
                      <button
                        onClick={() => removeSkill(sk.id)}
                        className="shrink-0 p-0.5 text-muted-foreground/50 hover:text-destructive transition-colors"
                        title="Delete skill"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    {sk.isBuiltin && <span className="text-[9px] text-muted-foreground/40 shrink-0">built-in</span>}
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 p-2.5 rounded-[6px] bg-muted/10 border border-border/30">
                <p className="text-[10px] text-muted-foreground mb-1.5">Add custom skill</p>
                <div className="flex gap-1.5">
                  <input value={newSkillName} onChange={e => setNewSkillName(e.target.value)} placeholder="Name" className="flex-1 bg-background border border-border/50 rounded-[5px] px-2 py-1 text-[11px] focus:outline-none focus:border-border/80" />
                  <input value={newSkillTrigger} onChange={e => setNewSkillTrigger(e.target.value)} placeholder="/trigger" className="w-24 bg-background border border-border/50 rounded-[5px] px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-border/80" />
                </div>
                <textarea value={newSkillInstruction} onChange={e => setNewSkillInstruction(e.target.value)} placeholder="Instruction prompt…" rows={2} className="w-full resize-none bg-background border border-border/50 rounded-[5px] px-2 py-1.5 text-[11px] focus:outline-none focus:border-border/80 placeholder:text-muted-foreground/40" />
                <button
                  onClick={addSkill}
                  disabled={!newSkillName.trim() || !newSkillTrigger.trim() || !newSkillInstruction.trim()}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-[5px] bg-muted/40 border border-border/50 text-foreground hover:bg-muted/60 disabled:opacity-40 transition-colors"
                >
                  Add skill
                </button>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="border-t border-border/60 px-5 py-3 flex justify-end gap-2 shrink-0">
            <button onClick={() => setS({ ...DEFAULT_SETTINGS })} className="btn-precision btn-secondary px-3.5 py-1.5 text-[12px] rounded-[6px]">Reset</button>
            <button onClick={handleSave} className="btn-precision px-3.5 py-1.5 text-[12px] bg-foreground/85 dark:bg-white/[0.04] text-background dark:text-foreground dark:border dark:border-white/[0.12] dark:hover:bg-white/[0.08] dark:hover:border-white/[0.2] rounded-[6px] hover:bg-foreground transition-colors">
              {saved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Home view ───────────────────────────────────────────

interface HomeViewProps {
  onOpenChat: (item: HistoryItem) => void;
  onStartChat: (content: string, action: ActionType, meta: { autonomyPreset: string; model: string; pageContexts?: string[] }) => void;
  history?: HistoryItem[];
  currentPageLabel?: string | null;
  onDismissContext?: () => void;
}

const SUGGESTIONS = [
  { icon: Play,        label: "Run a journey", prompt: "List my canonical journeys and help me choose one to run." },
  { icon: AlertCircle, label: "Review issues", prompt: "What are the most critical open issues right now?" },
  { icon: Plus,        label: "Map an application", prompt: "Help me map an application into canonical user journeys. Ask for the application URL." },
  { icon: BarChart2,   label: "Review UX evidence", prompt: "Analyze actual journey evidence for friction and explain which observations need human validation." },
];

function HomeView({ onStartChat, currentPageLabel, onDismissContext }: HomeViewProps) {
  const fillRef = useRef<((v: string) => void) | null>(null);
  return <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
    <div className="w-full max-w-[760px]">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold leading-tight">What should we test?</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Describe a goal. Your agent can map journeys, run checks, and investigate the evidence.</p>
      </div>
      <OperatorComposer onSend={onStartChat} fillRef={fillRef} slashDown pageContextLabel={currentPageLabel} onDismissContext={onDismissContext}/>
      <div className="mt-4 flex flex-wrap justify-center gap-2">{SUGGESTIONS.map(s=><button key={s.label} onClick={()=>fillRef.current?.(s.prompt)} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs hover:bg-muted"><s.icon size={13} className="text-muted-foreground"/>{s.label}</button>)}</div>
      <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">Journeys live in .traceback. Every finding links back to observed evidence.</p>
    </div>
  </div>;
}

// ─── Chat view ───────────────────────────────────────────

// ─── Member avatar ───────────────────────────────────────

function MemberAvatar({ m, size = "sm" }: { m: TeamMember; size?: "sm" | "xs" }) {
  const dim = size === "xs" ? "w-5 h-5 text-[9px]" : "w-7 h-7 text-[11px]";
  return (
    <div className={cn("rounded-full bg-gradient-to-tr flex items-center justify-center font-semibold text-white shrink-0", dim, m.color)}>
      {m.initials}
    </div>
  );
}

interface ChatViewProps {
  title: string;
  messages: Message[];
  artifact: Artifact | null;
  onBack: () => void;
  onSend: (content: string, action: ActionType, meta: { autonomyPreset: string; model: string }) => void;
  onOpenArtifact: (artifact: Artifact) => void;
  onCloseArtifact: () => void;
  pendingContextLabel: string | null;
  onDismissContext: () => void;
}

function ChatView({ title, messages, artifact, onBack, onSend, onOpenArtifact, onCloseArtifact, pendingContextLabel, onDismissContext }: ChatViewProps) {
  const threadRef = useRef<HTMLDivElement>(null);
  const [artifactWidth, setArtifactWidth] = useState(420);
  const isStreaming = messages.length > 0 && messages[messages.length - 1].streaming === true;
  const [participants, setParticipants] = useState<TeamMember[]>([TEAM[0]]);
  const [showInvite, setShowInvite] = useState(false);
  const [showArtifactList, setShowArtifactList] = useState(false);
  const inviteRef = useRef<HTMLDivElement>(null);
  const artifactListRef = useRef<HTMLDivElement>(null);

  const chatArtifacts: Artifact[] = messages.flatMap(m =>
    (m.components ?? []).reduce<Artifact[]>((acc, c) => {
      if (c.type === "test_draft")   acc.push({ type: "test_draft",   title: (c.data as TestDraftData).name,    data: c.data as TestDraftData });
      if (c.type === "suite_draft")  acc.push({ type: "suite_draft",  title: (c.data as SuiteDraftData).name,   data: c.data as SuiteDraftData });
      if (c.type === "run_report")   acc.push({ type: "run_report",   title: (c.data as RunReportData).testName, data: c.data as RunReportData });
      if (c.type === "issue_detail") acc.push({ type: "issue_detail", title: (c.data as IssueDetailData).title,  data: c.data as IssueDetailData });
      if (c.type === "test_detail")  acc.push({ type: "test_detail",  title: (c.data as TestDetailData).name,   data: c.data as TestDetailData });
      return acc;
    }, [])
  );

  // Smart auto-scroll: scroll to bottom unless user has scrolled up
  const userScrolledRef = useRef(false);
  const prevMsgCountRef = useRef(messages.length);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const onScroll = () => {
      userScrolledRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 150;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // When user sends a new message (count increases and last is user), unlock scroll
    if (messages.length > prevMsgCountRef.current) {
      const last = messages[messages.length - 1];
      if (last?.role === "user") userScrolledRef.current = false;
    }
    prevMsgCountRef.current = messages.length;

    if (!userScrolledRef.current && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inviteRef.current && !inviteRef.current.contains(e.target as Node)) setShowInvite(false);
      if (artifactListRef.current && !artifactListRef.current.contains(e.target as Node)) setShowArtifactList(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleMember = (m: TeamMember) => {
    setParticipants(prev =>
      prev.find(p => p.id === m.id) ? prev.filter(p => p.id !== m.id) : [...prev, m]
    );
  };

  const maxW = "max-w-[720px]";
  const multiUser = participants.length > 1;

  return (
    <div className="flex flex-col h-full overflow-hidden flex-1 min-w-0">
      {/* Header — spans full width above thread + artifact */}
      <div className="shrink-0 z-20 flex items-center gap-2.5 px-6 py-3 bg-background/80 backdrop-blur-md shadow-[0_1px_0_0_hsl(var(--border)/0.6),0_2px_12px_rgba(0,0,0,0.04)]">
        <button onClick={onBack} className="p-1 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0 -ml-1">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-[14px] font-semibold text-foreground truncate flex-1">{title}</span>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground border border-border/40 rounded-[6px] px-2.5 py-1 hover:bg-muted/50 transition-colors shrink-0 ml-2"
        >
          <Plus className="w-3 h-3" /> New chat
        </button>

        {/* Participant avatars */}
        <div className="flex items-center -space-x-1.5 shrink-0">
          {participants.map(p => <MemberAvatar key={p.id} m={p} size="xs" />)}
        </div>

        {/* Invite button */}
        <div ref={inviteRef} className="relative shrink-0">
          <span className="text-[11px] text-muted-foreground">Owner workspace</span>
          {showInvite && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-background border border-border rounded-[10px] shadow-lg overflow-hidden z-30">
              <div className="px-3 py-2 border-b border-border/50">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Team members</p>
              </div>
              {TEAM.filter(m => m.id !== "me").map(m => {
                const active = participants.find(p => p.id === m.id);
                return (
                  <button key={m.id} onClick={() => toggleMember(m)} className="flex items-center gap-2.5 w-full px-3 py-2.5 hover:bg-muted/40 transition-colors">
                    <MemberAvatar m={m} size="xs" />
                    <span className="flex-1 text-[13px] text-foreground text-left">{m.name}</span>
                    {active && <Check className="w-3.5 h-3.5 text-foreground shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Artifacts panel toggle */}
        {chatArtifacts.length > 0 && (
          <div ref={artifactListRef} className="relative shrink-0">
            <button
              onClick={() => setShowArtifactList(v => !v)}
              className={cn(
                "flex items-center gap-1.5 text-[11px] border border-border/50 rounded-[6px] px-2 py-1 transition-colors",
                showArtifactList || artifact
                  ? "text-foreground bg-muted/60 border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <PanelRight className="w-3.5 h-3.5" />
              <span>Artifacts</span>
              <span className={cn("text-[10px] rounded-full px-1.5 py-0.5 leading-none tabular-nums", showArtifactList || artifact ? "bg-foreground/10" : "bg-muted")}>{chatArtifacts.length}</span>
            </button>
            {showArtifactList && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-background border border-border rounded-[10px] shadow-lg overflow-hidden z-30">
                <div className="px-3 py-2 border-b border-border/50">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">In this chat</p>
                </div>
                {chatArtifacts.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => { onOpenArtifact(a); setShowArtifactList(false); }}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-3 py-2.5 hover:bg-muted/40 transition-colors text-left",
                      artifact?.title === a.title && "bg-muted/30"
                    )}
                  >
                    <FileCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-[13px] text-foreground truncate">{a.title}</span>
                    {artifact?.title === a.title && <Check className="w-3 h-3 text-muted-foreground shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body: full-width thread, artifact floats absolutely on the right */}
      <div className="flex-1 relative overflow-hidden">
        {/* Scrollable thread — full width so scrollbar stays at far right */}
        <div
          ref={threadRef}
          className="absolute inset-0 overflow-y-auto custom-scrollbar"
          style={artifact ? { paddingRight: `${artifactWidth + 24}px` } : undefined}
        >
          <div className={cn("mx-auto pt-8 pb-44", maxW)}>
            {messages.map((msg, i) => (
              <MessageItem
                key={msg.id}
                msg={msg}
                onOpenArtifact={onOpenArtifact}
                showFrom={multiUser}
                onChipClick={i === messages.length - 1 ? (prompt) => onSend(prompt, "Auto", { autonomyPreset: "balanced", model: "gpt-4o" }) : undefined}
              />
            ))}
          </div>
        </div>

        {/* Floating composer */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 z-10" style={artifact ? { paddingRight: `${artifactWidth + 48}px` } : undefined}>
          <div className={cn("mx-auto", maxW)}>
            <div className="shadow-[0_-2px_20px_-4px_rgba(0,0,0,0.08),0_8px_24px_-4px_rgba(0,0,0,0.08)] rounded-[12px]">
              <OperatorComposer
                onSend={onSend}
                pageContextLabel={pendingContextLabel}
                onDismissContext={onDismissContext}
                isStreaming={isStreaming}
              />
            </div>
          </div>
        </div>

        {/* Artifact — absolute, bottom-aligned with composer, gap from right edge */}
        {artifact && (
          <ArtifactPanel artifact={artifact} onClose={onCloseArtifact} width={artifactWidth} onWidthChange={setArtifactWidth} />
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────

export default function AgentWorkspace() {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const [view, setView] = useState<"home" | "chat">("home");
  const [draftVersion, setDraftVersion] = useState(0);
  const [chatTitle, setChatTitle] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingContextLabel, setPendingContextLabel] = useState<string | null>(null);
  const [pendingContextContent, setPendingContextContent] = useState<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  useEffect(()=>{const journey=new URLSearchParams(search).get('journey');if(journey){setPendingContextLabel(`Journey: ${journey}`);setPendingContextContent(`Review canonical journey ${journey}. Fetch it with get_canonical_journey and analyze its actual evidence. .traceback is the source of truth.`);}},[search, location]);

  // Resume sessions and context from existing workspace links
  useEffect(() => {
    // Resume session started from the popup widget
    const pendingId = localStorage.getItem("operatorPendingSession");
    if (pendingId) {
      localStorage.removeItem("operatorPendingSession");
      openChat({ id: pendingId, title: "Continuing conversation", time: "just now" });
    }
    const pendingCtx = localStorage.getItem("operatorPendingPageContext");
    if (pendingCtx) {
      localStorage.removeItem("operatorPendingPageContext");
      setPendingContextLabel(pendingCtx);
    }
    const pendingCtxContent = localStorage.getItem("operatorPendingPageContextContent");
    if (pendingCtxContent) {
      localStorage.removeItem("operatorPendingPageContextContent");
      setPendingContextContent(pendingCtxContent);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enterChat = () => { setView("chat"); };

  const openChat = useCallback(async (item: HistoryItem) => {
    setChatTitle(item.title);
    setArtifact(null);
    // Load real session
    try {
      const session = await operatorApi.getSession(item.id);
      setSessionId(item.id);
      setChatTitle(session.title || item.title);
      setMessages((session.messages ?? []).map((m: any) => ({
        id: m.id,
        role: m.role as "user" | "operator",
        content: m.content,
        components: m.components ?? [],
      })));
    } catch {
      setChatTitle("Conversation unavailable");
      setMessages([{id:"session-error",role:"operator",content:"This conversation could not be loaded. Choose another chat or start a new one."}]);
      setSessionId(item.id);
    }
    enterChat();
  }, []);

  useEffect(() => {
    const id = location.match(/^\/chats\/([^/]+)$/)?.[1];
    if (id && id !== sessionId) { streamAbortRef.current?.abort(); void openChat({id,title:"Conversation",time:""}); }
  }, [location, openChat, sessionId]);

  const startChat = useCallback(async (content: string, _action: ActionType, meta?: { autonomyPreset: string; model: string; pageContexts?: string[] }) => {
    const title = content.length > 60 ? content.slice(0, 57) + "…" : content;
    setChatTitle(title);
    setArtifact(null);

    // Create session — store pageLabel (from pendingContextLabel) so history can be grouped by origin page
    let sid: string;
    try {
      const session = await operatorApi.createSession(title, pendingContextLabel ?? undefined);
      sid = session.id;
    } catch {
      sid = `local_${Date.now()}`;
    }
    setSessionId(sid);
    if (!sid.startsWith("local_")) navigate(`/chats/${sid}`);

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content };
    const streamMsgId = `op_${Date.now()}`;
    const streamMsg: Message = { id: streamMsgId, role: "operator", content: "", streaming: true };
    setMessages([userMsg, streamMsg]);
    enterChat();

    // Stream response
    streamAbortRef.current?.abort();
    const ctrl = new AbortController();
    streamAbortRef.current = ctrl;
    let opContent = "";
    const opComponents: InlineComp[] = [];

    const opReasoning: string[] = [];
    sendOperatorMessage(sid, content, {
      onThinking: (step) => {
        opReasoning.push(step);
        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, reasoning: [...opReasoning] } : m));
      },
      onToken: (text) => {
        opContent += text;
        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, content: opContent } : m));
      },
      onReset: () => {
        opContent = '';
        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, content: '' } : m));
      },
      onComponent: (component) => {
        opComponents.push(component as InlineComp);
        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, components: [...opComponents] } : m));
        const c = component as InlineComp;
        if (c.type === "test_draft")   setArtifact({ type: "test_draft",   title: (c.data as TestDraftData).name,   data: c.data as TestDraftData });
        if (c.type === "suite_draft")  setArtifact({ type: "suite_draft",  title: (c.data as SuiteDraftData).name,  data: c.data as SuiteDraftData });
      },
      onDone: () => {
        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, streaming: false } : m));
      },
      onError: (msg) => {
        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, content: m.content || `Error: ${msg}`, streaming: false } : m));
      },
    }, ctrl.signal, { ...meta, pageContext: pendingContextContent ?? undefined }).catch(() => {});
  }, [pendingContextLabel, pendingContextContent]);

  const handleSend = useCallback((content: string, _action: ActionType, meta?: { autonomyPreset: string; model: string; pageContexts?: string[] }) => {
    const sid = sessionId;
    if (!sid) { startChat(content, _action, meta); return; }

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content };
    const streamMsgId = `op_${Date.now()}`;
    const streamMsg: Message = { id: streamMsgId, role: "operator", content: "", streaming: true };
    setMessages(prev => [...prev, userMsg, streamMsg]);

    streamAbortRef.current?.abort();
    const ctrl = new AbortController();
    streamAbortRef.current = ctrl;
    let opContent = "";
    const opComponents: InlineComp[] = [];

    const opReasoning2: string[] = [];
    sendOperatorMessage(sid, content, {
      onThinking: (step) => {
        opReasoning2.push(step);
        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, reasoning: [...opReasoning2] } : m));
      },
      onToken: (text) => {
        opContent += text;
        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, content: opContent } : m));
      },
      onReset: () => {
        opContent = '';
        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, content: '' } : m));
      },
      onComponent: (component) => {
        opComponents.push(component as InlineComp);
        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, components: [...opComponents] } : m));
        const c = component as InlineComp;
        if (c.type === "test_draft")   setArtifact({ type: "test_draft",   title: (c.data as TestDraftData).name,   data: c.data as TestDraftData });
        if (c.type === "suite_draft")  setArtifact({ type: "suite_draft",  title: (c.data as SuiteDraftData).name,  data: c.data as SuiteDraftData });
      },
      onDone: () => {
        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, streaming: false } : m));
      },
      onError: (msg) => {
        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, content: m.content || `Error: ${msg}`, streaming: false } : m));
      },
    }, ctrl.signal, { ...meta, pageContext: pendingContextContent ?? undefined }).catch(() => {});
  }, [sessionId, startChat, pendingContextContent]);

  useEffect(()=>{const listener=(event:Event)=>{const text=(event as CustomEvent).detail?.text;if(messages.some(m=>m.streaming)){event.preventDefault();return;}if(typeof text==='string'&&text.trim()&&text.length<=4000)handleSend(text,'Ask');};window.addEventListener('traceback:operator-prompt',listener);return()=>window.removeEventListener('traceback:operator-prompt',listener);},[handleSend,messages]);

  const goHome = () => {
    streamAbortRef.current?.abort();
    setView("home");
    setDraftVersion(v => v + 1);
    setMessages([]);
    setArtifact(null);
    setSessionId(null);
    navigate("/");
  };

  useEffect(() => {
    const newChat = () => { goHome(); setChatTitle(""); setPendingContextLabel(null); setPendingContextContent(null); };
    const context = () => {
      setPendingContextLabel(localStorage.getItem("operatorPendingPageContext"));
      setPendingContextContent(localStorage.getItem("operatorPendingPageContextContent"));
      localStorage.removeItem("operatorPendingPageContext"); localStorage.removeItem("operatorPendingPageContextContent");
    };
    window.addEventListener('traceback:new-chat',newChat);
    window.addEventListener('traceback:agent-context',context);
    return () => { window.removeEventListener('traceback:new-chat',newChat); window.removeEventListener('traceback:agent-context',context); };
  }, []);
  useEffect(() => () => streamAbortRef.current?.abort(), []);

  return (
    <Layout noScroll>
      <div className="flex h-full overflow-hidden relative">
        {view === "home" ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Agent settings"
              className="absolute top-4 right-5 z-30 p-1.5 rounded-[7px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <HomeView key={draftVersion} onOpenChat={openChat} onStartChat={startChat} currentPageLabel={pendingContextLabel} onDismissContext={() => { setPendingContextLabel(null); setPendingContextContent(null); }} />
          </div>
        ) : (
          <ChatView
            title={chatTitle}
            messages={messages}
            artifact={artifact}
            onBack={goHome}
            onSend={handleSend}
            onOpenArtifact={(a) => setArtifact(a)}
            onCloseArtifact={() => setArtifact(null)}
            pendingContextLabel={pendingContextLabel}
            onDismissContext={() => { setPendingContextLabel(null); setPendingContextContent(null); }}
          />
        )}

        <OperatorSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </Layout>
  );
}
