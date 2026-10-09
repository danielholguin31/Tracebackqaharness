import { currentProjectId } from '@/lib/api';
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Link, useLocation } from "wouter";
import { Layers, Play, MoreHorizontal, CheckCircle2, XCircle, Search, Plus, Calendar, GitCommit, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { suites as suitesApi } from "@/lib/api";
import { useSetOperatorContext } from "@/contexts/OperatorPageContext";

function relTime(iso?: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SuitesContent() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["suites", currentProjectId(), searchQuery],
    queryFn: () => suitesApi.list({ q: searchQuery || undefined }),
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => suitesApi.run(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suites"] }),
  });

  const suites = (data?.items ?? []).map((s: any) => {
    const triggers = (() => { try { return JSON.parse(s.triggersJson || "{}"); } catch { return {}; } })();
    const testIds = (() => { try { return JSON.parse(s.testIdsJson || "[]"); } catch { return []; } })();
    const type = triggers.onPr ? 'pr' : triggers.scheduled ? 'schedule' : triggers.onDeploy ? 'webhook' : 'manual';
    const schedule = triggers.onPr ? 'On PR' : triggers.scheduled ? 'Scheduled' : triggers.onDeploy ? 'On Deploy' : 'Manual';
    return {
      id: s.id,
      name: s.name,
      count: testIds.length,
      status: s.status,
      lastRun: relTime(s.lastRunAt),
      schedule,
      type,
    };
  });

  const passingCount = suites.filter(s => s.status === 'passing').length;
  const failingCount = suites.filter(s => s.status !== 'passing').length;
  useSetOperatorContext(data ? {
    label: `Suites (${suites.length})`,
    context: `Viewing the Suites list. ${suites.length} suites: ${passingCount} passing, ${failingCount} failing.${suites.length > 0 ? ` Suites: ${suites.map(s => `"${s.name}" (${s.count} tests, ${s.schedule}, last run ${s.lastRun})`).join('; ')}.` : ''}`,
  } : null);

  if (isError) return <div className="v2-state" role="alert"><h1>Could not load suites</h1><p>The workspace service is unavailable.</p><button className="btn-precision btn-secondary" onClick={() => refetch()}>Retry</button></div>;
  return (
    <div className="max-w-6xl mx-auto p-10 space-y-6 pb-20 w-full">

        {/* Header */}
        <PageHeader
          title="Suites"
          description="Group your tests together for scheduled or triggered runs."
          actions={
            <Link href="/suites/new" className="flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-[8px] border border-border/50 dark:border-white/[0.12] dark:bg-white/[0.04] text-foreground hover:bg-muted/50 hover:border-border/80 dark:hover:bg-white/[0.08] dark:hover:border-white/[0.2] transition-colors outline-none">
              <Plus className="w-4 h-4" />
              New Suite
            </Link>
          }
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search suites..."
              className="w-full surface-subtle border border-border rounded-[8px] pl-9 pr-3 py-1.5 text-[13px] focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {isLoading && <p className="text-[13px] text-muted-foreground py-8 text-center">Loading suites…</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {suites.map((suite: any) => (
            <div onClick={() => setLocation(`/suites/${suite.id}`)} key={suite.id} className="block cursor-pointer group bg-transparent border border-border/60 rounded-[8px] p-4 hover:bg-muted/30 transition-all relative overflow-hidden">
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div>
                  <h3 className="font-medium text-[13px] text-foreground">{suite.name}</h3>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{suite.count} tests</div>
                </div>
                <button onClick={(e) => e.stopPropagation()} className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-all p-1 hover:bg-muted rounded border border-transparent">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 mb-4 relative z-10">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-0 py-1 rounded">
                  {suite.type === 'schedule' && <Calendar className="w-3.5 h-3.5" />}
                  {suite.type === 'webhook' && <Webhook className="w-3.5 h-3.5" />}
                  {suite.type === 'pr' && <GitCommit className="w-3.5 h-3.5" />}
                  {suite.type === 'manual' && <Play className="w-3.5 h-3.5" />}
                  Trigger: <span className="font-medium text-foreground">{suite.schedule}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/40 relative z-10">
                <div className="flex items-center gap-2 text-[11px] font-medium">
                  {suite.status === 'passing' ? (
                    <span className="text-[#16a34a] flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Passing</span>
                  ) : (
                    <span className="text-destructive flex items-center gap-1.5"><XCircle className="w-3 h-3" /> Failing</span>
                  )}
                  <Link href={`/runs/${suite.id}`} onClick={(e) => e.stopPropagation()} className="text-muted-foreground font-normal hidden sm:inline hover:underline hover:text-foreground transition-colors cursor-pointer">• Run {suite.lastRun}</Link>
                </div>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); runMutation.mutate(suite.id); }} className="text-muted-foreground hover:text-primary px-2 py-1 text-[11px] flex items-center gap-1.5 group/btn transition-colors">
                  <Play className="w-3 h-3 fill-current group-hover/btn:text-primary transition-colors" /> Run
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
  );
}

export default function Suites() {
  return <Layout><SuitesContent /></Layout>;
}
