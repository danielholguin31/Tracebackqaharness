import { currentProjectId } from '@/lib/api';
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { CheckCircle2, XCircle, AlertCircle, PlayCircle, MoreHorizontal, Search, Github, Clock, SlidersHorizontal } from "lucide-react";
import { RunTestSelector } from "@/components/RunTestSelector";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { runs as runsApi } from "@/lib/api";
import { useSetOperatorContext } from "@/contexts/OperatorPageContext";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const RUN_PHASES = ["Setting up", "Running", "Analyzing", "Finalizing"] as const;

function getPhaseFromElapsed(startedAt: string): string {
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
  if (elapsed < 8)  return "Setting up";
  if (elapsed < 40) return "Running";
  if (elapsed < 60) return "Analyzing";
  return "Finalizing";
}

function LivePhaseChip({ startedAt }: { startedAt: string }) {
  const [phase, setPhase] = useState(() => getPhaseFromElapsed(startedAt));
  useEffect(() => {
    const id = setInterval(() => setPhase(getPhaseFromElapsed(startedAt)), 2000);
    return () => clearInterval(id);
  }, [startedAt]);
  const idx = RUN_PHASES.indexOf(phase as typeof RUN_PHASES[number]);
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--run-text)] opacity-60" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--run-text)]" />
      </span>
      <span className="text-[12px] text-foreground/80">{phase}</span>
      <span className="text-[11px] text-muted-foreground/40 font-mono">{idx + 1}/4</span>
    </div>
  );
}

function fmtDuration(s?: number | null) {
  if (!s) return "-";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
function relTime(iso?: string | null) {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  );
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return <span className="font-mono text-[13px] text-muted-foreground">{m}:{String(s).padStart(2, '0')}</span>;
}

const MOCK_LIVE_RUNS = [
  {
    id: '__mock_autonomous__',
    testName: 'Login flow — staging',
    mode: 'autonomous',
    triggeredBy: 'manual',
    branch: 'main',
    startedAt: new Date(Date.now() - 42000).toISOString(),
  },
  {
    id: '__mock_deterministic__',
    testName: 'Signup flow — staging',
    mode: 'deterministic',
    triggeredBy: 'pr',
    branch: 'feat/new-auth',
    startedAt: new Date(Date.now() - 18000).toISOString(),
  },
];

const FILTER_TABS = [
  { value: 'all',      label: 'All' },
  { value: 'failures', label: 'Failures' },
  { value: 'healed',   label: 'Healed' },
];

function ModeChip({ mode }: { mode: string }) {
  return mode === 'autonomous'
    ? <span className="status-chip status-running">Autonomous</span>
    : <span className="status-chip status-neutral">Deterministic</span>;
}

function TriggeredByCell({ userType, user }: { userType: string; user: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
      {userType === 'user' && (
        <div className="w-3.5 h-3.5 rounded-[2px] bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[7px] text-white font-semibold shrink-0">
          {user.charAt(0)}
        </div>
      )}
      {userType === 'github' && <Github className="w-3.5 h-3.5 text-foreground/60 shrink-0" />}
      {userType === 'schedule' && <Clock className="w-3.5 h-3.5 shrink-0" />}
      <span>{user}</span>
    </div>
  );
}

export function RunsContent() {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [triggerFilter, setTriggerFilter] = useState('all');

  const statusParam = filter === 'failures' ? 'failed' : filter === 'healed' ? 'healed' : undefined;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["runs", currentProjectId(), filter, searchQuery],
    queryFn: () => runsApi.list({ status: statusParam, q: searchQuery || undefined }),
  });

  const apiRuns = data?.items ?? [];
  const apiLiveRuns = apiRuns.filter((r: any) => ['running','initializing','queued','paused'].includes(r.status));
  const liveRuns = apiLiveRuns;

  const allHistoryRuns = apiRuns
    .filter((r: any) => !['running','initializing','queued','paused'].includes(r.status))
    .map((r: any) => ({
      id: r.id,
      test: r.testName,
      mode: r.mode,
      status: r.status === 'passed' ? 'pass' : r.status === 'failed' ? 'fail' : r.status === 'healed' ? 'partial' : r.status,
      duration: fmtDuration(r.duration),
      branch: r.branch ?? 'main',
      triggeredBy: r.triggeredBy,
      userType: r.triggeredBy === 'pr' || r.triggeredBy === 'deploy' ? 'github' : r.triggeredBy === 'schedule' ? 'schedule' : 'user',
      user: r.triggeredBy === 'pr' ? 'PR' : r.triggeredBy === 'deploy' ? 'Deploy' : r.triggeredBy === 'schedule' ? 'Scheduled' : 'Workspace owner',
      time: relTime(r.startedAt),
    }));

  const filteredRuns = allHistoryRuns
    .filter((r: any) => modeFilter === 'all' || r.mode === modeFilter)
    .filter((r: any) => triggerFilter === 'all' || r.triggeredBy === triggerFilter);

  const passCount = filteredRuns.filter(r => r.status === 'pass').length;
  const failCount = filteredRuns.filter(r => r.status === 'fail').length;

  useSetOperatorContext(data ? {
    label: `Runs (${filteredRuns.length})`,
    context: `Viewing the Runs list. ${liveRuns.length} run${liveRuns.length !== 1 ? 's' : ''} currently live.${filteredRuns.length > 0 ? ` History: ${filteredRuns.length} runs shown — ${passCount} passed, ${failCount} failed.` : ''} Most recent: "${filteredRuns[0]?.test ?? 'none'}" — ${filteredRuns[0]?.status ?? ''} ${filteredRuns[0]?.time ?? ''}.`,
  } : null);

  const TRIGGER_LABELS: Record<string, string> = {
    all: 'All Triggers',
    manual: 'Manual',
    pr: 'Pull Request',
    deploy: 'Deploy',
    schedule: 'Scheduled',
  };

  const MODE_LABELS: Record<string, string> = {
    all: 'All Modes',
    autonomous: 'Autonomous',
    deterministic: 'Deterministic',
  };

  // Shared column widths — applied to both tables so columns align
  const colMode       = "w-[130px]";
  const colDuration   = "w-[110px]";
  const colTriggered  = "w-[150px]";
  const colTime       = "w-[110px]";
  const colActions    = "w-10";

  if (isError) return <div className="v2-state" role="alert"><h1>Could not load runs</h1><p>The workspace service is unavailable.</p><button className="btn-precision btn-secondary" onClick={() => refetch()}>Retry</button></div>;
  return (
    <div className="max-w-6xl mx-auto p-10 space-y-8 pb-20 w-full">

      {/* Header */}
      <PageHeader
        title="Runs"
        description="Monitor live executions and review run history across all your tests."
        actions={
          <>
            <RunTestSelector
              trigger={
                <button className="flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-[8px] border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border/80 transition-colors outline-none">
                  <PlayCircle className="w-3.5 h-3.5" />
                  Run a test
                </button>
              }
              align="end"
              sideOffset={8}
            />
          </>
        }
      />

      {/* Live Runs Section */}
      {liveRuns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-foreground flex items-center gap-2">
              Live Runs
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--run-text)] opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--run-text)]" />
              </span>
            </h2>
            <span className="text-[12px] text-muted-foreground/60">{liveRuns.length} running</span>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground/80">
                  <th className="px-4 py-2.5 font-normal">Test</th>
                  <th className={`px-4 py-2.5 font-normal ${colMode}`}>Mode</th>
                  <th className={`px-4 py-2.5 font-normal ${colDuration}`}>Elapsed</th>
                  <th className={`px-4 py-2.5 font-normal ${colTriggered}`}>Triggered By</th>
                  <th className={`px-4 py-2.5 font-normal ${colTime}`}>Status</th>
                  <th className={`px-4 py-2.5 font-normal ${colActions}`}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {liveRuns.map((run: any) => (
                  <tr
                    key={run.id}
                    className="hover:bg-muted/50 transition-colors group cursor-pointer"
                    onClick={() => window.location.href = `/runs/live/${run.mode === 'autonomous' ? 'autonomous' : 'deterministic'}${run.id.startsWith('__mock') ? '' : `?id=${run.id}`}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground group-hover:underline decoration-border underline-offset-4">
                        {run.testName}
                      </div>
                    </td>
                    <td className={`px-4 py-2.5 ${colMode}`}>
                      <ModeChip mode={run.mode} />
                    </td>
                    <td className={`px-4 py-2.5 ${colDuration}`}>
                      <ElapsedTimer startedAt={run.startedAt} />
                    </td>
                    <td className={`px-4 py-2.5 ${colTriggered}`}>
                      <TriggeredByCell
                        userType={run.triggeredBy === 'pr' || run.triggeredBy === 'deploy' ? 'github' : run.triggeredBy === 'schedule' ? 'schedule' : 'user'}
                        user={run.triggeredBy === 'pr' ? 'PR' : run.triggeredBy === 'deploy' ? 'Deploy' : run.triggeredBy === 'schedule' ? 'Scheduled' : 'Workspace owner'}
                      />
                    </td>
                    <td className={`px-4 py-2.5 ${colTime}`}>
                      <LivePhaseChip startedAt={run.startedAt} />
                    </td>
                    <td className={`px-4 py-2.5 text-right ${colActions}`}>
                      <button
                        className="p-1 hover:bg-muted/70 rounded-[6px] text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-foreground">Run History</h2>
          {filteredRuns.length > 0 && (
            <span className="text-[12px] text-muted-foreground/60">{filteredRuns.length} runs</span>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <SegmentedTabs tabs={FILTER_TABS} value={filter} onChange={setFilter} />
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search runs…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-44 border border-border/50 bg-background rounded-[8px] pl-8 pr-3 py-1.5 text-[13px] focus:outline-none focus:border-border/80 transition-colors placeholder:text-muted-foreground/60"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1.5 border rounded-[8px] px-3 py-1.5 text-[13px] transition-colors",
                    (modeFilter !== 'all' || triggerFilter !== 'all')
                      ? "border-foreground/30 text-foreground bg-muted/40"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filters
                  {(modeFilter !== 'all' || triggerFilter !== 'all') && (
                    <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-foreground text-background text-[10px] font-semibold">
                      {[modeFilter !== 'all', triggerFilter !== 'all'].filter(Boolean).length}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 surface-subtle border-border text-foreground p-1 rounded-[8px]" align="end" sideOffset={8}>
                <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Mode</DropdownMenuLabel>
                {Object.entries(MODE_LABELS).map(([v, label]) => (
                  <DropdownMenuItem
                    key={v}
                    onClick={() => setModeFilter(v)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-[6px] cursor-pointer text-[13px]"
                  >
                    {label}
                    {modeFilter === v && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-foreground/50" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Triggered By</DropdownMenuLabel>
                {Object.entries(TRIGGER_LABELS).map(([v, label]) => (
                  <DropdownMenuItem
                    key={v}
                    onClick={() => setTriggerFilter(v)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-[6px] cursor-pointer text-[13px]"
                  >
                    {label}
                    {triggerFilter === v && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-foreground/50" />}
                  </DropdownMenuItem>
                ))}
                {(modeFilter !== 'all' || triggerFilter !== 'all') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => { setModeFilter('all'); setTriggerFilter('all'); }}
                      className="px-2 py-1.5 rounded-[6px] cursor-pointer text-[13px] text-muted-foreground"
                    >
                      Clear filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground/80">
                <th className="px-4 py-2.5 font-normal">Test</th>
                <th className={`px-4 py-2.5 font-normal ${colMode}`}>Mode</th>
                <th className={`px-4 py-2.5 font-normal ${colDuration}`}>Duration</th>
                <th className={`px-4 py-2.5 font-normal ${colTriggered}`}>Triggered By</th>
                <th className={`px-4 py-2.5 font-normal ${colTime}`}>Time</th>
                <th className={`px-4 py-2.5 font-normal ${colActions}`}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[13px] text-muted-foreground">Loading runs…</td>
                </tr>
              )}
              {filteredRuns.map((run: any) => (
                <tr
                  key={run.id}
                  className="hover:bg-muted/50 transition-colors group cursor-pointer"
                  onClick={() => window.location.href = `/runs/${run.id}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {run.status === 'pass'    && <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a] shrink-0" />}
                      {run.status === 'fail'    && <XCircle      className="w-3.5 h-3.5 text-destructive shrink-0" />}
                      {run.status === 'partial' && <AlertCircle  className="w-3.5 h-3.5 text-[#ca8a04] shrink-0" />}
                      <div>
                        <div className="font-medium text-foreground group-hover:underline decoration-border underline-offset-4">
                          {run.test}
                        </div>
                        {run.branch && run.branch !== 'main' && (
                          <div className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">{run.branch}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-2.5 ${colMode}`}>
                    <ModeChip mode={run.mode} />
                  </td>
                  <td className={`px-4 py-2.5 text-muted-foreground font-mono ${colDuration}`}>{run.duration}</td>
                  <td className={`px-4 py-2.5 ${colTriggered}`}>
                    <TriggeredByCell userType={run.userType} user={run.user} />
                  </td>
                  <td className={`px-4 py-2.5 text-muted-foreground ${colTime}`}>{run.time}</td>
                  <td className={`px-4 py-2.5 text-right opacity-0 group-hover:opacity-100 transition-opacity ${colActions}`}>
                    <button className="p-1 hover:bg-muted/70 rounded-[6px] text-muted-foreground hover:text-foreground transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredRuns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <p className="text-[13px] font-medium text-foreground mb-1">No runs found</p>
                    <p className="text-[12px] text-muted-foreground">
                      {searchQuery || filter !== 'all' || modeFilter !== 'all' || triggerFilter !== 'all'
                        ? 'Try adjusting your filters.'
                        : 'Use "Run a test" above to execute your first test.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Runs() {
  return <Layout><RunsContent /></Layout>;
}
