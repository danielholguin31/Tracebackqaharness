import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Link } from "wouter";
import { Search, ChevronDown, CheckCircle2, XCircle, Clock, GitPullRequest, Zap, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { events as eventsApi } from "@/lib/api";
import { useSetOperatorContext } from "@/contexts/OperatorPageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function relTime(iso?: string | null) {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fmtDuration(seconds?: number | null) {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

export default function Events() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["events", searchQuery, typeFilter, statusFilter],
    queryFn: () => eventsApi.list({
      q: searchQuery || undefined,
      type: typeFilter !== "all" ? typeFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    }),
  });

  const events = (data?.items ?? []).map((e: any) => {
    const result = (() => { try { return JSON.parse(e.resultJson || '{"passed":0,"failed":0}'); } catch { return { passed: 0, failed: 0 }; } })();
    return {
      id: e.id,
      type: e.type,
      summary: e.summary,
      initiated: relTime(e.initiatedAt),
      duration: fmtDuration(e.duration),
      result,
      status: e.status,
      prNumber: e.prNumber ? `#${e.prNumber}` : undefined,
      branch: e.branch,
    };
  });

  const failedCount = events.filter(e => e.status === 'fail' || e.status === 'failed').length;
  const passedCount = events.filter(e => e.status === 'pass' || e.status === 'passed').length;
  useSetOperatorContext(data ? {
    label: `Events (${events.length})`,
    context: `Viewing the Events list. ${events.length} events shown${typeFilter !== 'all' ? ` (filtered: ${typeFilter})` : ''}. ${passedCount} passed, ${failedCount} failed.${events.length > 0 ? ` Most recent: "${events[0].summary}" — ${events[0].initiated}.` : ''}`,
  } : null);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-10 space-y-6 pb-20">

        {/* Header */}
        <PageHeader title="Events" description="Automated runs triggered by PRs and MCP agents." />

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="w-full surface-subtle border border-border rounded-[8px] pl-9 pr-3 py-1.5 text-[13px] focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 surface-subtle border border-border rounded-[8px] hover:bg-muted transition-colors text-foreground">
                  <span className="text-muted-foreground">Trigger:</span> {typeFilter === "all" ? "All" : typeFilter === "pr" ? "Pull Requests" : "MCP Agent"} <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 surface-subtle border-border p-1 rounded-[8px]">
                <DropdownMenuItem onClick={() => setTypeFilter("all")} className="flex items-center justify-between text-[13px] rounded-[8px] cursor-pointer hover:bg-muted p-2">All Triggers {typeFilter === "all" && <CheckCircle2 className="w-3.5 h-3.5" />}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("pr")} className="flex items-center justify-between text-[13px] rounded-[8px] cursor-pointer hover:bg-muted mt-0.5 p-2">Pull Requests {typeFilter === "pr" && <CheckCircle2 className="w-3.5 h-3.5" />}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("mcp")} className="flex items-center justify-between text-[13px] rounded-[8px] cursor-pointer hover:bg-muted mt-0.5 p-2">MCP Agent {typeFilter === "mcp" && <CheckCircle2 className="w-3.5 h-3.5" />}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 surface-subtle border border-border rounded-[8px] hover:bg-muted transition-colors text-foreground">
                  <span className="text-muted-foreground">Status:</span> {statusFilter === "all" ? "All" : statusFilter === "pass" ? "Passed" : "Failed"} <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 surface-subtle border-border p-1 rounded-[8px]">
                <DropdownMenuItem onClick={() => setStatusFilter("all")} className="flex items-center justify-between text-[13px] rounded-[8px] cursor-pointer hover:bg-muted p-2">All Status {statusFilter === "all" && <CheckCircle2 className="w-3.5 h-3.5" />}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pass")} className="flex items-center justify-between text-[13px] rounded-[8px] cursor-pointer hover:bg-muted mt-0.5 p-2">Passed {statusFilter === "pass" && <CheckCircle2 className="w-3.5 h-3.5" />}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("fail")} className="flex items-center justify-between text-[13px] rounded-[8px] cursor-pointer hover:bg-muted mt-0.5 p-2">Failed {statusFilter === "fail" && <CheckCircle2 className="w-3.5 h-3.5" />}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Events Table */}
        <div className="overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-[14px] whitespace-nowrap border-t border-border/50">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground/80 hover:bg-muted/30 transition-colors">
                  <th className="px-3 py-2 font-normal border-r border-border/30 w-32">Trigger</th>
                  <th className="px-3 py-2 font-normal border-r border-border/30">Summary</th>
                  <th className="px-3 py-2 font-normal border-r border-border/30">Initiated</th>
                  <th className="px-3 py-2 font-normal border-r border-border/30">Duration</th>
                  <th className="px-3 py-2 font-normal border-r border-border/30">Result</th>
                  <th className="px-3 py-2 font-normal border-r border-border/30 w-24">Status</th>
                  <th className="px-3 py-2 font-normal text-right w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading && <tr><td colSpan={7} className="px-3 py-8 text-center text-[13px] text-muted-foreground">Loading events…</td></tr>}
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-muted/50 transition-colors group cursor-pointer" onClick={() => window.location.href=`/events/${event.id}`}>
                    <td className="px-3 py-2 border-r border-border/30">
                      <div className="flex items-center gap-2">
                        {event.type === 'pr' ? (
                          <div className="flex items-center gap-1.5 text-[12px] bg-muted px-2 py-0.5 rounded-[8px] border border-border/50 w-fit">
                            <GitPullRequest className="w-3 h-3 text-foreground" />
                            <span className="font-mono text-muted-foreground">{event.prNumber}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[12px] bg-muted px-2 py-0.5 rounded-[8px] border border-border/50 w-fit">
                            <Zap className="w-3 h-3 text-[rgb(var(--run-bg))]" />
                            <span className="font-medium text-foreground">MCP</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-border/30">
                      <div className="text-[13px] text-foreground group-hover:underline decoration-border underline-offset-4 truncate max-w-[350px]">
                        {event.summary.split(' ').length > 5 ? event.summary.split(' ').slice(0, 5).join(' ') + '...' : event.summary}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-[13px] border-r border-border/30">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {event.initiated}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-[13px] border-r border-border/30">
                      {event.duration}
                    </td>
                    <td className="px-3 py-2 border-r border-border/30">
                      <div className="flex gap-2">
                        {event.result.passed > 0 && (
                          <span className="text-[12px] flex items-center gap-1 text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]"></span>
                            {event.result.passed}
                          </span>
                        )}
                        {event.result.failed > 0 && (
                          <span className="text-[12px] flex items-center gap-1 text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]"></span>
                            {event.result.failed}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-border/30">
                      {event.status === 'pass' ? (
                        <span className="status-chip bg-[#16a34a]/10 text-[#16a34a] border-[#16a34a]/20">Passed</span>
                      ) : (
                        <span className="status-chip bg-[#dc2626]/10 text-[#dc2626] border-[#dc2626]/20">Failed</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 hover:bg-muted/70 rounded-[8px] text-muted-foreground hover:text-foreground">
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
    </Layout>
  );
}
