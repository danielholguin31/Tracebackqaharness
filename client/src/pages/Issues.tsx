import { currentProjectId } from '@/lib/api';
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Search, ChevronDown, CheckCircle2, AlertTriangle, AlertCircle, SignalHigh, SignalMedium, SignalLow } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issues as issuesApi } from "@/lib/api";
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
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const SEV_DOT: Record<string, string> = {
  critical: "bg-[#dc2626]",
  high:     "bg-[#d97706]",
  warning:  "bg-[#ca8a04]",
  info:     "bg-accent",
};

const SEV_CHIP: Record<string, string> = {
  critical: "bg-[#dc2626]/10 text-[#dc2626] border-[#dc2626]/20",
  high:     "bg-[#d97706]/10 text-[#d97706] border-[#d97706]/20",
  warning:  "bg-[#ca8a04]/8 text-[#ca8a04] border-[#ca8a04]/15",
  info:     "bg-accent/10 text-accent border-accent/20",
};

const STATUS_CHIP: Record<string, string> = {
  open:      "bg-muted/50 text-foreground border-border/50",
  pushed:    "bg-primary/10 text-primary border-primary/20",
  resolved:  "bg-[#16a34a]/10 text-[#16a34a] border-[#16a34a]/20",
  dismissed: "bg-muted/30 text-muted-foreground/60 border-border/30",
};

const SEV_LABEL: Record<string, string> = {
  critical: "Urgent",
  high:     "High",
  warning:  "Medium",
  info:     "Low",
};

function SevIcon({ severity }: { severity: string }) {
  if (severity === "critical") return <AlertCircle  className="w-3 h-3 shrink-0" />;
  if (severity === "high")     return <SignalHigh   className="w-3 h-3 shrink-0" />;
  if (severity === "warning")  return <SignalMedium className="w-3 h-3 shrink-0" />;
  return <SignalLow className="w-3 h-3 shrink-0" />;
}

const STATUS_TABS = ["open", "all", "pushed", "resolved", "dismissed"] as const;

export function IssuesContent() {
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [severityFilter, setSeverityFilter] = useState("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["issues", currentProjectId(), searchQuery, statusFilter, severityFilter],
    queryFn: () => issuesApi.list({
      q: searchQuery || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      severity: severityFilter !== "all" ? severityFilter : undefined,
    }),
  });

  const pushMutation = useMutation({
    mutationFn: ({ id, target }: { id: string; target: 'github' | 'linear' | 'jira' }) =>
      issuesApi.push(id, target),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["issues"] }),
  });
  const dismissMutation = useMutation({
    mutationFn: (id: string) =>
      issuesApi.update(id, { status: "dismissed", dismissReason: "wont_fix" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["issues"] }),
  });

  const issues = (data?.items ?? []).map((i: any) => ({
    id: i.id,
    title: i.title,
    severity: i.severity,
    status: i.status,
    runId: i.runId,
    runDate: relTime(i.createdAt),
    testName: i.flow ?? "",
    triggerType: i.triggeredBy,
  }));

  const criticalCount = issues.filter(i => i.severity === "critical").length;
  const highCount = issues.filter(i => i.severity === "high").length;
  const openCount = issues.filter(i => i.status === "open").length;
  useSetOperatorContext(data ? {
    label: `Issues (${issues.length})`,
    context: `Viewing the Issues list (filter: ${statusFilter}${severityFilter !== 'all' ? `, severity: ${severityFilter}` : ''}). ${issues.length} issues shown — ${criticalCount} critical, ${highCount} high, ${openCount} open.${issues.length > 0 ? ` Most recent: "${issues[0].title}" (${issues[0].severity}, ${issues[0].status}) in "${issues[0].testName}" — ${issues[0].runDate}.` : ''}`,
  } : null);

  if (isError) return <div className="v2-state" role="alert"><h1>Could not load issues</h1><p>The workspace service is unavailable.</p><button className="btn-precision btn-secondary" onClick={() => refetch()}>Retry</button></div>;
  return (
    <div className="max-w-6xl mx-auto p-10 space-y-6 pb-20 w-full">

      {/* Header */}
      <PageHeader
        title="Issues"
        description="Bugs identified by testing agents that need your review."
        actions={
          <div className="flex items-center gap-2">
            {issues.length > 0 && (
              <span className="text-[12px] font-medium text-muted-foreground bg-muted/50 border border-border/50 rounded-full px-2.5 py-0.5">
                {issues.length} {statusFilter !== "all" ? statusFilter : "total"}
              </span>
            )}
            {criticalCount > 0 && (
              <span className="text-[12px] font-medium text-[#dc2626] bg-[#dc2626]/8 border border-[#dc2626]/15 rounded-full px-2.5 py-0.5">
                {criticalCount} critical
              </span>
            )}
          </div>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <SegmentedTabs
          tabs={STATUS_TABS.map(s => ({ value: s, label: s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1) }))}
          value={statusFilter}
          onChange={setStatusFilter}
        />

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search issues…"
              className="w-52 border border-border/50 bg-background rounded-[8px] pl-8 pr-3 py-1.5 text-[13px] focus:outline-none focus:border-border/80 transition-colors placeholder:text-muted-foreground/60"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 border border-border/50 bg-background rounded-[8px] hover:bg-muted/40 transition-colors text-[12px] text-foreground">
                {severityFilter === "all"
                  ? "Any severity"
                  : SEV_LABEL[severityFilter] ?? severityFilter}
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-36 border-border/40 p-1 rounded-[8px]" align="end">
              {["all", "critical", "high", "warning", "info"].map(s => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className="flex items-center gap-2 p-2 rounded-[6px] cursor-pointer hover:bg-muted/60 focus:bg-muted/60 text-[13px] outline-none"
                >
                  {s !== "all"
                    ? <span className={cn(
                        s === "critical" ? "text-[#dc2626]" :
                        s === "high"     ? "text-[#d97706]" :
                        s === "warning"  ? "text-[#ca8a04]" : "text-accent"
                      )}><SevIcon severity={s} /></span>
                    : <div className="w-3 shrink-0" />
                  }
                  {s === "all" ? "All" : SEV_LABEL[s]}
                  {severityFilter === s && <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border/40 rounded-[8px] overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              <th className="w-9 pl-4" />
              <th className="px-3 py-2.5 text-[11px] font-medium text-muted-foreground/80 tracking-wide">Issue</th>
              <th className="px-3 py-2.5 text-[11px] font-medium text-muted-foreground/80 tracking-wide w-28">Severity</th>
              <th className="px-3 py-2.5 text-[11px] font-medium text-muted-foreground/80 tracking-wide w-52">Test</th>
              <th className="px-3 py-2.5 text-[11px] font-medium text-muted-foreground/80 tracking-wide w-24">Age</th>
              <th className="w-20 pr-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-16 text-center text-[13px] text-muted-foreground">
                  Loading issues…
                </td>
              </tr>
            )}
            {!isLoading && issues.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <p className="text-[13px] font-medium text-foreground mb-1">No issues found</p>
                  <p className="text-[12px] text-muted-foreground">Try adjusting your filters or search query.</p>
                </td>
              </tr>
            )}
            {issues.map(issue => (
              <tr
                key={issue.id}
                className="group cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => { window.location.href = `/issues/${issue.id}`; }}
              >
                {/* Severity dot */}
                <td className="pl-4 pr-1 py-3.5">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    SEV_DOT[issue.severity] ?? "bg-muted-foreground"
                  )} />
                </td>

                {/* Title */}
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-[13.5px] text-foreground truncate max-w-[340px]">
                      {issue.title}
                    </span>
                    {issue.status !== "open" && (
                      <span className={cn(
                        "status-chip !rounded-full border shrink-0",
                        STATUS_CHIP[issue.status]
                      )}>
                        {issue.status}
                      </span>
                    )}
                    {issue.triggerType === "pr" && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-[#ca8a04] bg-[#ca8a04]/8 border border-[#ca8a04]/15 !rounded-full rounded-full px-2 py-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> PR
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] font-mono text-muted-foreground/50 mt-0.5">
                    {issue.id.slice(0, 7)}
                  </p>
                </td>

                {/* Severity chip */}
                <td className="px-3 py-3.5">
                  <span className={cn(
                    "status-chip !rounded-full border inline-flex items-center gap-1",
                    SEV_CHIP[issue.severity] ?? "bg-muted text-muted-foreground border-border"
                  )}>
                    <SevIcon severity={issue.severity} />
                    {SEV_LABEL[issue.severity] ?? issue.severity}
                  </span>
                </td>

                {/* Test */}
                <td className="px-3 py-3.5">
                  <span className="text-[12.5px] font-mono text-muted-foreground truncate block max-w-[190px]">
                    {issue.testName || "—"}
                  </span>
                </td>

                {/* Age */}
                <td className="px-3 py-3.5 text-[12.5px] text-muted-foreground whitespace-nowrap">
                  {issue.runDate}
                </td>

                {/* Actions */}
                <td className="pr-3 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1 px-2.5 py-1 text-[12px] text-muted-foreground border border-border/50 bg-background rounded-[6px] hover:bg-muted/40 hover:text-foreground transition-colors">
                        Actions <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-44 border-border/40 p-1 rounded-[8px]" align="end">
                      <DropdownMenuItem
                        onClick={() => pushMutation.mutate({ id: issue.id, target: "github" })}
                        className="flex items-center gap-2 p-2 rounded-[6px] cursor-pointer hover:bg-muted/60 focus:bg-muted/60 text-[13px] outline-none"
                      >
                        Push to GitHub
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => pushMutation.mutate({ id: issue.id, target: "linear" })}
                        className="flex items-center gap-2 p-2 rounded-[6px] cursor-pointer hover:bg-muted/60 focus:bg-muted/60 text-[13px] outline-none"
                      >
                        Push to Linear
                      </DropdownMenuItem>
                      <div className="h-px bg-border/40 my-1" />
                      <DropdownMenuItem
                        onClick={() => dismissMutation.mutate(issue.id)}
                        className="flex items-center gap-2 p-2 rounded-[6px] cursor-pointer hover:bg-destructive/10 focus:bg-destructive/10 hover:text-destructive focus:text-destructive text-[13px] outline-none"
                      >
                        Dismiss
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Issues() {
  return <Layout><IssuesContent /></Layout>;
}
