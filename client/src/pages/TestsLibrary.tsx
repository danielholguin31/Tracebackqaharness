import { currentProjectId } from '@/lib/api';
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Search, Plus, Eye, MoreHorizontal, CheckCircle2, XCircle, SlidersHorizontal, ArrowLeft, Play, Settings2, History, Code2, Edit2, Bot, Info } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { tests as testsApi } from "@/lib/api";
import { useSetOperatorContext } from "@/contexts/OperatorPageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function relativeTime(iso?: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function TestsLibraryContent() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tests", currentProjectId(), searchQuery, modeFilter],
    queryFn: () => testsApi.list({ q: searchQuery || undefined, mode: modeFilter !== "all" ? modeFilter : undefined }),
  });

  const tests = (data?.items ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    mode: t.mode,
    suites: (() => { try { return JSON.parse(t.suiteIdsJson || "[]").map((id: string) => id.replace("suite_", "").replace(/_/g, " ")); } catch { return []; } })(),
    status: t.status === "pass" ? "pass" : t.status === "fail" ? "fail" : "never_run",
    date: relativeTime(t.lastRunAt),
  }));

  const autonomousCount = tests.filter(t => t.mode === "autonomous").length;
  const deterministicCount = tests.filter(t => t.mode === "deterministic").length;
  const passingCount = tests.filter(t => t.status === "pass").length;
  const failingCount = tests.filter(t => t.status === "fail").length;
  useSetOperatorContext(data ? {
    label: `Tests (${tests.length})`,
    context: `Viewing the Test Definitions library. ${tests.length} tests${modeFilter !== 'all' ? ` (filtered: ${modeFilter})` : ''}: ${autonomousCount} autonomous, ${deterministicCount} deterministic. ${passingCount} passing, ${failingCount} failing.${tests.length > 0 ? ` Tests: ${tests.slice(0, 5).map(t => `"${t.name}"`).join(', ')}${tests.length > 5 ? ` and ${tests.length - 5} more` : ''}.` : ''}`,
  } : null);

  if (isError) return <div className="v2-state" role="alert"><h1>Could not load testslibrary</h1><p>The workspace service is unavailable.</p><button className="btn-precision btn-secondary" onClick={() => refetch()}>Retry</button></div>;
  return (
    <div className="max-w-6xl mx-auto p-10 space-y-6 pb-20 w-full">

        {/* Header */}
        <PageHeader title="Test Definitions" description="Manage and organize your test library." actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-[8px] border border-border/50 dark:border-white/[0.12] dark:bg-white/[0.04] text-foreground hover:bg-muted/50 hover:border-border/80 dark:hover:bg-white/[0.08] dark:hover:border-white/[0.2] transition-colors outline-none">
                <Plus className="w-4 h-4" />
                New Test Definition
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 surface-subtle border-border text-foreground p-1.5 rounded-[8px]" align="end">
              <div className="text-[11px] font-medium text-muted-foreground px-2 py-1 mb-0.5 uppercase tracking-wider">New Test Definition</div>

              <DropdownMenuItem
                onClick={() => setLocation('/tests/new/autonomous' + (currentProjectId() ? '?projectId=' + currentProjectId() : ''))}
                className="flex items-start gap-3 p-2.5 rounded-[8px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors outline-none"
              >
                <div className="p-1.5 rounded-[6px] bg-muted mt-0.5 shrink-0">
                  <Bot className="w-3.5 h-3.5 text-foreground" />
                </div>
                <div>
                  <div className="text-[13px] font-medium leading-none mb-1">Autonomous</div>
                  <div className="text-[12px] text-muted-foreground leading-snug">
                    AI agent with its own cursor — just define a goal
                  </div>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setLocation('/tests/new/deterministic' + (currentProjectId() ? '?projectId=' + currentProjectId() : ''))}
                className="flex items-start gap-3 p-2.5 rounded-[8px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors mt-0.5 outline-none"
              >
                <div className="p-1.5 rounded-[6px] bg-muted mt-0.5 shrink-0">
                  <Code2 className="w-3.5 h-3.5 text-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[13px] font-medium leading-none">Deterministic</span>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-[12px] max-w-[200px] bg-foreground text-background">
                          Playwright-based with AI self-healing. Steps can be defined manually or generated with AI.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="text-[12px] text-muted-foreground leading-snug">
                    Precise steps + AI self-healing
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        } />

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tests..."
                className="w-full surface-subtle border border-border rounded-[8px] pl-9 pr-3 py-1.5 text-[13px] focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="btn-precision btn-secondary px-3 py-1.5 text-[13px] flex items-center gap-2 text-foreground outline-none">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {modeFilter === "all" ? "Filter" : modeFilter === "autonomous" ? "Autonomous" : "Deterministic"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 surface-subtle border-border text-foreground  p-1 rounded-[8px]" align="end">
                <DropdownMenuItem onClick={() => setModeFilter("all")} className="flex items-center justify-between px-2 py-1.5 text-[13px] cursor-pointer hover:bg-muted outline-none rounded-[8px]">
                  All Tests {modeFilter === "all" && <CheckCircle2 className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setModeFilter("autonomous")} className="flex items-center justify-between px-2 py-1.5 text-[13px] cursor-pointer hover:bg-muted outline-none rounded-[8px]">
                  Autonomous Only {modeFilter === "autonomous" && <CheckCircle2 className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setModeFilter("deterministic")} className="flex items-center justify-between px-2 py-1.5 text-[13px] cursor-pointer hover:bg-muted outline-none rounded-[8px]">
                  Deterministic Only {modeFilter === "deterministic" && <CheckCircle2 className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-[13px] whitespace-nowrap border-t border-border/50">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground/80 hover:bg-muted/30 transition-colors">
                  <th className="px-3 py-2 font-normal border-r border-border/30">Test Name</th>
                  <th className="px-3 py-2 font-normal border-r border-border/30">Mode</th>
                  <th className="px-3 py-2 font-normal border-r border-border/30">Suites</th>
                  <th className="px-3 py-2 font-normal border-r border-border/30">Last Run</th>
                  <th className="px-3 py-2 font-normal border-r border-border/30">Date</th>
                  <th className="px-3 py-2 font-normal w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-[13px] text-muted-foreground">Loading tests…</td></tr>
                )}
                {!isLoading && tests.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-[13px] text-muted-foreground">No tests found.</td></tr>
                )}
                {tests.map(test => (
                  <tr key={test.id} className="hover:bg-muted/50 transition-colors group cursor-pointer" onClick={() => setLocation(`/tests/${test.id}`)}>
                    <td className="px-3 py-2 border-r border-border/30">
                      <div className="font-medium text-foreground group-hover:underline decoration-border underline-offset-4 flex items-center gap-2">
                        {test.name}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground border-r border-border/30">
                      <div className="flex items-center gap-1.5">
                        {test.mode === 'autonomous' ? <span className="status-chip mode-chip status-passed">Autonomous</span> : <span className="status-chip mode-chip bg-muted text-foreground">Deterministic</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-border/30">
                      <div className="flex gap-1.5">
                        {test.suites.map((s: string) => (
                          <span key={s} className="px-2 py-0.5 rounded-[8px] text-[11px] bg-muted border border-border/50 text-muted-foreground">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-border/30">
                      {test.status === 'pass' ? (
                        <span className="inline-flex items-center gap-1.5 text-[#16a34a] font-medium text-[13px]"><CheckCircle2 className="w-3.5 h-3.5" /> Pass</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-destructive font-medium text-[13px]"><XCircle className="w-3.5 h-3.5" /> Fail</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-[13px] border-r border-border/30">{test.date}</td>
                    <td className="px-3 py-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
  );
}

export default function TestsLibrary() {
  return <Layout><TestsLibraryContent /></Layout>;
}
