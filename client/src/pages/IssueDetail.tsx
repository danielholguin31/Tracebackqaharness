import { Layout } from "@/components/Layout";
import { useSetOperatorContext } from "@/contexts/OperatorPageContext";
import { Link } from "wouter";
import {
  ArrowLeft, CheckCircle2, ChevronDown, Plus, ExternalLink,
  ChevronRight, Terminal, Copy, Check, Loader2,
  AlertCircle, SignalHigh, SignalMedium, SignalLow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issues as issuesApi } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

function SectionCard({ label, headerRight, children }: {
  label: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border/40 rounded-[8px] overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/20 border-b border-border/30 flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        {headerRight}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function IssueDetail({ params }: any) {
  const id = params?.id || "";
  const qc = useQueryClient();

  const [agentPromptOpen, setAgentPromptOpen] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState<string | null>(null);
  const [agentPromptLoading, setAgentPromptLoading] = useState(false);
  const [agentPromptError, setAgentPromptError] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadAgentPrompt = useCallback(async (force = false) => {
    if (!force && agentPrompt !== null) return;
    setAgentPromptLoading(true);
    setAgentPromptError(false);
    setAgentPrompt(null);
    try {
      const result = await issuesApi.agentPrompt(id);
      setAgentPrompt(result.prompt);
    } catch {
      setAgentPromptError(true);
    } finally {
      setAgentPromptLoading(false);
    }
  }, [id, agentPrompt]);

  const handleTogglePrompt = () => {
    const next = !agentPromptOpen;
    setAgentPromptOpen(next);
    if (next) loadAgentPrompt();
  };

  const handleCopy = () => {
    if (!agentPrompt) return;
    navigator.clipboard.writeText(agentPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: issueData, isLoading, isError, refetch } = useQuery({
    queryKey: ["issue", id],
    queryFn: () => issuesApi.get(id),
    enabled: !!id,
  });

  useSetOperatorContext(issueData ? {
    label: `Issue: ${issueData.title}`,
    context: `Viewing issue "${issueData.title}" (ID: ${id}). Severity: ${issueData.severity}. Status: ${issueData.status}. Test flow: ${issueData.flow ?? 'unknown'}. Evidence: ${issueData.evidence ?? 'none'}. Proposed solution: ${issueData.proposedSolution ?? 'none'}.`,
  } : null);

  const updateMutation = useMutation({
    mutationFn: (patch: any) => issuesApi.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["issue", id] }),
  });

  const pushMutation = useMutation({
    mutationFn: (target: "github" | "linear") => issuesApi.push(id, target),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["issue", id] }),
  });

  if (isError) return <Layout><div className="v2-state" role="alert"><h1>Issue unavailable</h1><p>This issue may have been removed.</p><button className="btn-precision btn-secondary" onClick={() => refetch()}>Retry</button><Link href="/issues">Back to issues</Link></div></Layout>;
  if (isLoading || !issueData) {
    return (
      <Layout>
        {(pushMutation.isError || updateMutation.isError) && <div className="v2-error" role="alert">{pushMutation.error?.message || updateMutation.error?.message}</div>}
      <div className="max-w-[960px] mx-auto px-10 pt-10 text-[13px] text-muted-foreground">
          Loading…
        </div>
      </Layout>
    );
  }

  const issue = {
    id: issueData.id,
    title: issueData.title,
    severity: issueData.severity as string,
    status: issueData.status as string,
    agentNote: issueData.agentNote ?? issueData.evidence ?? "",
    runId: issueData.runId,
    runDate: issueData.createdAt ? new Date(issueData.createdAt).toLocaleString() : "—",
    testName: issueData.flow ?? "",
    evidence: issueData.evidence ?? "",
    proposedSolution: issueData.proposedSolution ?? "",
  };

  return (
    <Layout>
      {(pushMutation.isError || updateMutation.isError) && <div className="v2-error" role="alert">{pushMutation.error?.message || updateMutation.error?.message}</div>}
      <div className="max-w-[960px] mx-auto px-10 pt-8 pb-20">

        {/* Back */}
        <Link href="/issues" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6 group">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Issues
        </Link>

        <div className="animate-in fade-in duration-300">

          {/* Header card */}
          <div className="border border-border/40 rounded-[8px] px-5 pt-4 pb-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className={cn(
                "status-chip !rounded-full border inline-flex items-center gap-1",
                SEV_CHIP[issue.severity]
              )}>
                <SevIcon severity={issue.severity} />
                {SEV_LABEL[issue.severity] ?? issue.severity}
              </span>
              <span className={cn("status-chip !rounded-full border", STATUS_CHIP[issue.status])}>
                {issue.status}
              </span>
              <span className="ml-auto text-[12px] font-mono text-muted-foreground/50">
                {issue.id.slice(0, 8)}
              </span>
            </div>
            <h1 className="text-[16px] font-semibold text-foreground leading-snug">
              {issue.title}
            </h1>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-[1fr_272px] gap-5">

            {/* ── Main column ── */}
            <div className="space-y-4 min-w-0">

              {/* Summary */}
              <SectionCard label="Summary">
                <p className="text-[13px] text-foreground leading-relaxed">{issue.agentNote}</p>
              </SectionCard>

              {/* Evidence */}
              <SectionCard
                label="Evidence"
                headerRight={
                  <Link
                    href={`/runs/${issue.runId}`}
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Run {issue.runId?.slice(0, 8)}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                }
              >
                <pre className="font-mono text-[12px] text-[#d97706] leading-relaxed whitespace-pre-wrap break-words border-l-2 border-[#ca8a04]/30 pl-3 bg-transparent">
                  {issue.evidence || "No evidence captured."}
                </pre>
              </SectionCard>

              {/* Proposed Solution */}
              {issue.proposedSolution && (
                <SectionCard label="Proposed Solution">
                  <p className="text-[13px] text-foreground leading-relaxed">{issue.proposedSolution}</p>
                </SectionCard>
              )}

              {/* Agent Fix Prompt */}
              <div className="border border-border/40 rounded-[8px] overflow-hidden">
                <button
                  onClick={handleTogglePrompt}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/20 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">
                      Agent Fix Prompt
                    </p>
                    <span className="text-[11px] text-muted-foreground/50 font-mono normal-case">
                      paste into Cursor, Claude, Copilot…
                    </span>
                  </div>
                  <ChevronRight className={cn(
                    "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                    agentPromptOpen && "rotate-90"
                  )} />
                </button>

                {agentPromptOpen && (
                  <div className="border-t border-border/30 animate-in fade-in slide-in-from-top-1 duration-150">
                    {agentPromptLoading ? (
                      <div className="flex items-center gap-2.5 p-5 text-[13px] text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                        Generating fix prompt…
                      </div>
                    ) : agentPromptError ? (
                      <div className="flex items-center justify-between px-5 py-4">
                        <p className="text-[13px] text-muted-foreground">Failed to generate prompt.</p>
                        <button
                          onClick={() => loadAgentPrompt(true)}
                          className="text-[12px] text-muted-foreground border border-border/50 bg-background rounded-[6px] px-2.5 py-1 hover:bg-muted/40 hover:text-foreground transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="relative">
                          <button
                            onClick={handleCopy}
                            className={cn(
                              "absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] border text-[11px] transition-all",
                              copied
                                ? "bg-[#16a34a]/10 border-[#16a34a]/30 text-[#16a34a]"
                                : "bg-background border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70"
                            )}
                          >
                            {copied
                              ? <><Check className="w-3 h-3" /> Copied</>
                              : <><Copy className="w-3 h-3" /> Copy</>
                            }
                          </button>
                          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-foreground/80 bg-muted/30 border border-border/30 rounded-[6px] p-4 pr-24 overflow-x-auto custom-scrollbar">
                            {agentPrompt}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* ── Sidebar ── */}
            <div className="space-y-4">

              {/* Actions */}
              <div className="border border-border/40 rounded-[8px] overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/20 border-b border-border/30">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Actions</p>
                </div>
                <div className="p-3 flex flex-col gap-2">

                  {issue.status === "open" && (
                    <>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="btn-precision btn-sm w-full justify-center gap-1.5 bg-white/[0.08] text-foreground border-white/[0.18] hover:bg-white/[0.14] hover:border-white/[0.24] transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                            Approve & Push
                            <ChevronDown className="w-3 h-3 opacity-70 ml-auto" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 border-border/40 p-1 rounded-[8px]" align="end">
                          <DropdownMenuItem
                            onClick={() => pushMutation.mutate("github")}
                            className="flex items-center gap-2 p-2 rounded-[6px] cursor-pointer hover:bg-muted/60 focus:bg-muted/60 text-[13px] outline-none"
                          >
                            Push to GitHub
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => pushMutation.mutate("linear")}
                            className="flex items-center gap-2 p-2 rounded-[6px] cursor-pointer hover:bg-muted/60 focus:bg-muted/60 text-[13px] outline-none"
                          >
                            Push to Linear
                          </DropdownMenuItem>
                          <div className="h-px bg-border/40 my-1" />
                          <DropdownMenuItem className="flex items-center gap-2 p-2 rounded-[6px] cursor-pointer hover:bg-muted/60 focus:bg-muted/60 text-[13px] outline-none">
                            Copy as Markdown
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="btn-precision btn-secondary btn-sm w-full justify-center gap-1.5">
                            Dismiss
                            <ChevronDown className="w-3 h-3 opacity-60 ml-auto" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-44 border-border/40 p-1 rounded-[8px]" align="end">
                          <DropdownMenuItem
                            onClick={() => updateMutation.mutate({ status: "dismissed", dismissReason: "not_a_bug" })}
                            className="flex items-center gap-2 p-2 rounded-[6px] cursor-pointer hover:bg-muted/60 focus:bg-muted/60 text-[13px] outline-none"
                          >
                            Not a bug
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateMutation.mutate({ status: "dismissed", dismissReason: "wont_fix" })}
                            className="flex items-center gap-2 p-2 rounded-[6px] cursor-pointer hover:bg-muted/60 focus:bg-muted/60 text-[13px] outline-none"
                          >
                            Won't fix
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateMutation.mutate({ status: "dismissed", dismissReason: "duplicate" })}
                            className="flex items-center gap-2 p-2 rounded-[6px] cursor-pointer hover:bg-muted/60 focus:bg-muted/60 text-[13px] outline-none"
                          >
                            Duplicate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}

                  {issue.status === "pushed" && (
                    <>
                      {issueData.externalRefJson && (() => {
                        try {
                          const r = JSON.parse(issueData.externalRefJson);
                          return (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener"
                              className="btn-precision btn-secondary btn-sm w-full justify-center gap-1.5"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View in GitHub
                            </a>
                          );
                        } catch { return null; }
                      })()}
                      <button
                        onClick={() => updateMutation.mutate({ status: "resolved" })}
                        className="btn-precision btn-sm w-full justify-center gap-1.5"
                        style={{ backgroundColor: "#16a34a", color: "#fff", borderColor: "#16a34a" }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Resolved
                      </button>
                      <button
                        onClick={() => updateMutation.mutate({ status: "open" })}
                        className="btn-precision btn-ghost btn-sm w-full justify-center"
                      >
                        Reopen
                      </button>
                    </>
                  )}

                  {(issue.status === "resolved" || issue.status === "dismissed") && (
                    <button
                      onClick={() => updateMutation.mutate({ status: "open" })}
                      className="btn-precision btn-secondary btn-sm w-full justify-center"
                    >
                      Reopen Issue
                    </button>
                  )}

                </div>
              </div>

              {/* Details */}
              <div className="border border-border/40 rounded-[8px] overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/20 border-b border-border/30">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Details</p>
                </div>
                <div className="divide-y divide-border/30">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[12px] text-muted-foreground">Severity</span>
                    <span className={cn("status-chip !rounded-full border inline-flex items-center gap-1", SEV_CHIP[issue.severity])}>
                      <SevIcon severity={issue.severity} />
                      {SEV_LABEL[issue.severity] ?? issue.severity}
                    </span>
                  </div>
                  <div className="flex items-start justify-between px-4 py-2.5 gap-3">
                    <span className="text-[12px] text-muted-foreground shrink-0">Test</span>
                    <span className="text-[12px] font-mono text-foreground text-right truncate">
                      {issue.testName || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[12px] text-muted-foreground">Run</span>
                    <Link
                      href={`/runs/${issue.runId}`}
                      className="inline-flex items-center gap-1 text-[12px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {issue.runId?.slice(0, 8)}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[12px] text-muted-foreground">Detected</span>
                    <span className="text-[12px] text-muted-foreground">{issue.runDate}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
