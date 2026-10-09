import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import {
  ArrowLeft,
  GitPullRequest,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  ExternalLink,
  Code2,
  GitBranch,
  Github,
  Bug,
  LayoutGrid,
  FileText,
  Activity,
  Terminal,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { events as eventsApi } from "@/lib/api";
import { useSetOperatorContext } from "@/contexts/OperatorPageContext";

function relTime(iso?: string | null) {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDuration(seconds?: number | null) {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

function TabButton({ active, onClick, icon, children }: { active: boolean, onClick: () => void, icon?: React.ReactNode, children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 pb-3 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
      )}
    >
      {icon && React.cloneElement(icon as React.ReactElement<any>, { className: "w-4 h-4" })}
      {children}
    </button>
  );
}

export default function EventDetail({ params }: { params?: { id?: string } }) {
  const eventId = params?.id || '';
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [expandedAgentResponse, setExpandedAgentResponse] = useState(false);

  const { data: eventData, isLoading, isError, refetch } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventsApi.get(eventId),
    enabled: !!eventId,
  });

  const resultParsed = (() => { try { return JSON.parse(eventData?.resultJson || '{"passed":0,"failed":0}'); } catch { return { passed: 0, failed: 0 }; } })();
  useSetOperatorContext(eventData ? {
    label: `Event: ${eventData.summary?.split(' ').slice(0, 4).join(' ') ?? eventId.slice(0, 8)}`,
    context: `Viewing event "${eventData.summary}" (ID: ${eventId}). Type: ${eventData.type === 'pr' ? `PR #${eventData.prNumber}` : 'MCP agent'}. Status: ${eventData.status}. Branch: ${eventData.branch ?? 'unknown'}. Duration: ${fmtDuration(eventData.duration)}. Initiated: ${relTime(eventData.initiatedAt)}. Results: ${resultParsed.passed} passed, ${resultParsed.failed} failed.`,
  } : null);

  if (isError || (!isLoading && !eventData)) return <Layout><div className="v2-state" role="alert"><h1>Event unavailable</h1><button className="btn-precision btn-secondary" onClick={() => refetch()}>Retry</button><Link href="/events">Back to events</Link></div></Layout>;
  if (isLoading) {
    return <Layout><div className="max-w-6xl mx-auto p-10 text-[13px] text-muted-foreground">Loading event…</div></Layout>;
  }

  const result = (() => { try { return JSON.parse(eventData?.resultJson || '{"passed":0,"failed":0}'); } catch { return { passed: 0, failed: 0 }; } })();
  const testIds: string[] = (() => { try { return JSON.parse(eventData?.testIdsJson || '[]'); } catch { return []; } })();
  const issueIds: string[] = (() => { try { return JSON.parse(eventData?.issueIdsJson || '[]'); } catch { return []; } })();

  const event = {
    id: eventData?.id || eventId,
    type: eventData?.type || "pr",
    summary: eventData?.summary || "",
    initiated: relTime(eventData?.initiatedAt),
    initiatedBy: "Tool call received",
    duration: fmtDuration(eventData?.duration),
    status: eventData?.status || "pass",
    prNumber: eventData?.prNumber ? `#${eventData.prNumber}` : undefined,
    repo: "Connected repository",
    branch: eventData?.branch ? `main ← ${eventData.branch}` : undefined,
    author: "",
    agentPrompt: eventData?.rawPayloadJson ? (() => { try { return JSON.parse(eventData.rawPayloadJson)?.prompt || ""; } catch { return ""; } })() : "",
    responsePayload: eventData?.agentResponse || "",
    issuesCreated: issueIds.map((id: string) => ({ id, title: id, severity: "high", url: `/issues/${id}` })),
    ephemeralTests: testIds.map((id: string) => ({ id, name: id, status: "pass", duration: "-", log: "", generatedFrom: "", prompt: "" })),
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-10 pb-20">

        {/* Header - Consistent with RunReport */}
        <div className="mb-8">
          <Link href="/events" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6 group">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to Events
          </Link>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-[16px] font-semibold tracking-tight text-foreground flex items-center gap-3">
                  {event.summary}
                </h1>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[12px] font-semibold tracking-wider",
                  event.status === 'pass' ? "bg-[#16a34a]/10 text-[#16a34a] border border-[#16a34a]/20" :
                  event.status === 'fail' ? "bg-destructive/10 text-destructive border border-destructive/20" :
                  "bg-[#ca8a04]/10 text-[#ca8a04] border border-[#ca8a04]/20"
                )}>
                  {event.status.toUpperCase()}
                </span>

                {event.type === 'pr' ? (
                  <span className="px-2 py-0.5 rounded-[8px] bg-transparent text-muted-foreground text-[10px] font-semibold uppercase tracking-wider border border-border flex items-center gap-1.5">
                    <GitPullRequest className="w-3 h-3" /> PR Run
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-[8px] bg-transparent text-muted-foreground text-[10px] font-semibold uppercase tracking-wider border border-border flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-[rgb(var(--run-bg))]" /> MCP Run
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
                <span className="flex items-center gap-1.5 font-mono"><Clock className="w-3.5 h-3.5" /> {event.duration}</span>
                <span>•</span>
                <span className="font-mono">{event.initiated}</span>
                <span>•</span>
                <span className="font-mono text-[12px]">{event.id}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="btn-precision btn-secondary px-3 py-1.5 text-[12px] flex items-center gap-2">
                <ExternalLink className="w-4 h-4" /> Share Link
              </button>
            </div>
          </div>
        </div>

        {/* Tabs - Contextual based on RunReport */}
        <div className="flex items-center gap-6 border-b border-border mb-8 overflow-x-auto no-scrollbar">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<FileText />}>Overview</TabButton>
          <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<Terminal />}>Execution Logs</TabButton>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-10 animate-in fade-in duration-300">

            {/* Section 1: Context */}
            <div>
              <h2 className="text-[13px] font-medium text-foreground mb-4">Context</h2>

              {event.type === 'pr' ? (
                <div className="surface-subtle border border-border rounded-[8px] overflow-hidden">
                  <div className="p-5 flex flex-col md:flex-row gap-6 md:items-center justify-between border-b border-border/60">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono text-[13px] text-muted-foreground">{event.prNumber}</span>
                        <h3 className="text-[13px] font-medium text-foreground">{event.summary}</h3>
                      </div>
                      <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                        <span className="flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5" /> {event.repo}</span>
                        <span>•</span>
                        <span className="font-mono">{event.branch}</span>
                        <span>•</span>
                        <span>by {event.author}</span>
                      </div>
                    </div>
                    <button className="btn-precision btn-secondary px-4 py-2 text-[13px] flex justify-center items-center gap-2 shrink-0 bg-background">
                      <Github className="w-4 h-4" /> View on GitHub <ExternalLink className="w-3 h-3 ml-1 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="p-4 bg-background">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground w-24">Author:</span>
                        <span className="text-[13px] text-muted-foreground">{event.author}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground w-24">Repository:</span>
                        <span className="text-[13px] text-muted-foreground">{event.repo}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground w-24">Branch:</span>
                        <span className="text-[13px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-[8px]">{event.branch}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="surface-subtle border border-border rounded-[8px] overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-2 text-[13px] text-muted-foreground">
                      <Zap className="w-4 h-4 text-[rgb(var(--run-bg))]" />
                      <span className="font-medium text-foreground">MCP Event</span>
                      <span>•</span>
                      <span>{event.initiatedBy}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Ephemeral Test Results */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[13px] font-medium text-foreground">Ephemeral Test Results</h2>
                  <p className="text-[13px] text-muted-foreground mt-1">Tests generated automatically for this event.</p>
                </div>
                <div className="text-[13px] text-muted-foreground font-mono">
                  {event.ephemeralTests?.length || 0} tests generated
                </div>
              </div>

              <div className="border border-border rounded-[8px] overflow-hidden bg-background">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-[13px] whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-border surface-subtle text-muted-foreground/80">
                        <th className="px-4 py-3 font-medium border-r border-border/50 w-8"></th>
                        <th className="px-4 py-3 font-medium border-r border-border/50">Generated Test Name</th>
                        <th className="px-4 py-3 font-medium border-r border-border/50 w-24">Status</th>
                        <th className="px-4 py-3 font-medium border-r border-border/50 w-24">Duration</th>
                        <th className="px-4 py-3 font-medium">Context / Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 bg-background">
                      {event.ephemeralTests && event.ephemeralTests.map(test => (
                        <React.Fragment key={test.id}>
                          <tr
                            className="hover:bg-muted/30 transition-colors cursor-pointer group"
                            onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                          >
                            <td className="px-4 py-3 border-r border-border/50">
                              <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", expandedTest === test.id && "rotate-90")} />
                            </td>
                            <td className="px-4 py-3 border-r border-border/50">
                              <span className="font-medium text-foreground group-hover:underline decoration-border underline-offset-4">{test.name}</span>
                            </td>
                            <td className="px-4 py-3 border-r border-border/50">
                              {test.status === 'pass' ? (
                                <span className="inline-flex items-center gap-1.5 text-[#16a34a] font-medium text-[13px]"><CheckCircle2 className="w-4 h-4" /> Pass</span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-destructive font-medium text-[13px]"><XCircle className="w-4 h-4" /> Fail</span>
                              )}
                            </td>
                            <td className="px-4 py-3 border-r border-border/50 text-muted-foreground font-mono text-[13px]">
                              {test.duration}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-[13px] truncate max-w-[300px]">
                              {event.type === 'pr' ? test.generatedFrom : test.prompt}
                            </td>
                          </tr>
                          {expandedTest === test.id && (
                            <tr className="bg-muted/10">
                              <td colSpan={5} className="p-0">
                                <div className="p-4 border-l-[3px] border-l-primary/30">
                                  <div className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Execution Log</div>
                                  <div className="bg-muted border border-border/50 rounded-[8px] overflow-hidden">
                                    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-background/50">
                                      <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span className="text-[11px] font-medium text-muted-foreground">Trace</span>
                                    </div>
                                    <div className="p-4 overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar bg-[#0f0f0a]">
                                      {test.log.split('\n').map((line, i) => (
                                        <div key={i} className="flex gap-4 font-mono text-[12px] leading-relaxed">
                                          <span className="text-muted-foreground/30 select-none text-right w-6 shrink-0">{i + 1}</span>
                                          <span className={cn(
                                            line.startsWith('Error:') || line.startsWith('Timeout') ? "text-[#ef4444]" :
                                            line.includes('successful') || line.includes('completed') ? "text-[#22c55e]" :
                                            "text-[#e5e5e5]"
                                          )}>
                                            {line}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Section 3: Type-specific output */}
            <div>
              {event.type === 'pr' ? (
                <>
                  <h2 className="text-[13px] font-medium text-foreground mb-4">Issues Generated</h2>

                  <div className="border border-border rounded-[8px] overflow-hidden bg-background">
                    {event.issuesCreated && event.issuesCreated.length > 0 ? (
                      <div className="divide-y divide-border/50">
                        {event.issuesCreated.map(issue => (
                          <Link key={issue.id} href={issue.url} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group">
                            <div className="flex items-center gap-4">
                              <Bug className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-[8px] border border-border/50">TR-{1000 + issue.id}</span>
                                  <span className="text-[11px] font-medium bg-[#ca8a04]/10 text-[#ca8a04] border border-[#ca8a04]/20 px-1.5 py-0.5 rounded-[8px]">
                                    {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)} Severity
                                  </span>
                                </div>
                                <div className="font-medium text-foreground group-hover:underline decoration-border underline-offset-4 text-[13px]">
                                  {issue.title}
                                </div>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors group-hover:translate-x-1" />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-[13px] text-muted-foreground surface-subtle">
                        No issues generated
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-[13px] font-medium text-foreground mb-4">Agent Response</h2>

                  <div className="border border-border rounded-[8px] overflow-hidden bg-background">
                    <div className="p-5 border-b border-border/50 surface-subtle">
                      <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Tests Run</span>
                          <span className="font-mono text-[18px]">1</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-medium text-[#16a34a] uppercase tracking-wider mb-1">Passed</span>
                          <span className="font-mono text-[18px] text-[#16a34a]">1</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-medium text-destructive uppercase tracking-wider mb-1">Failed</span>
                          <span className="font-mono text-[18px] text-destructive">0</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-0">
                       <button
                         onClick={() => setExpandedAgentResponse(!expandedAgentResponse)}
                         className="flex items-center justify-between w-full p-4 hover:bg-muted/30 transition-colors text-[13px] font-medium text-foreground"
                       >
                         View Raw Response Payload
                         <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expandedAgentResponse && "rotate-180")} />
                       </button>
                       {expandedAgentResponse && (
                         <div className="p-4 bg-background border-t border-border/50">
                           <pre className="text-[12px] font-mono text-muted-foreground whitespace-pre-wrap bg-muted/30 p-4 rounded-[8px] border border-border/50">
                             {event.responsePayload}
                           </pre>
                         </div>
                       )}
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        )}

        {activeTab === 'logs' && (
          <div className="animate-in fade-in duration-300">
             <div className="bg-[#0f0f0a] border border-border rounded-[8px] p-6 text-[13px] font-mono text-[#e5e5e5] min-h-[400px]">
               <div className="text-muted-foreground/50">[2023-10-24 14:14:02] Event triggered. Initializing environment...</div>
               <div className="text-muted-foreground/50">[2023-10-24 14:14:05] Environment ready. Starting tests...</div>
               <div className="mt-4 text-primary">➜ Running test: Guest user adds item to cart</div>
               <div className="text-[#22c55e] ml-4">✓ [PASS] Test completed in 45s</div>
               <div className="mt-4 text-primary">➜ Running test: Guest user proceeds to checkout</div>
               <div className="text-[#ef4444] ml-4">✗ [FAIL] Error: Element locator "button#proceed-checkout" has attribute 'disabled'...</div>
             </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
