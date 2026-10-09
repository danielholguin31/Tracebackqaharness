import { WorkspaceShellContext } from '@/contexts/WorkspaceShellContext';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { PersonalWorkspaceLayout } from '@/layouts/PersonalWorkspaceLayout';
import { personal, currentProjectId } from '@/lib/api';
import { Sidebar } from "@/components/Sidebar";
import { useState, useRef, useEffect, useContext } from "react";
import { useLocation } from "wouter";
import { OperatorPageContext, type PageContextEntry } from "@/contexts/OperatorPageContext";
import { cn } from "@/lib/utils";
import {
  Command, X, Minus, Maximize2, ArrowUp, ChevronDown,
  Play, Plus, BarChart2, Check, Clock,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { operator as operatorApi, issues as issuesApi, runs as runsApi, tests as testsApi, suites as suitesApi } from "@/lib/api";
import { sendOperatorMessage } from "@/lib/operatorStream";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";


// ─── Ask Operator popup ──────────────────────────────────

type ActionType = "Auto" | "Ask" | "Run" | "Create Test";

const QUICK_ACTIONS = [
  { label: "Run a test",       icon: <Play      className="w-3 h-3" /> },
  { label: "Diagnose failure", icon: <BarChart2 className="w-3 h-3" /> },
  { label: "Create new test",  icon: <Plus      className="w-3 h-3" /> },
];

const ACTIONS: { value: ActionType; hint: string }[] = [
  { value: "Auto",        hint: "Let Operator decide" },
  { value: "Ask",         hint: "Ask a question" },
  { value: "Run",         hint: "Trigger a test run" },
  { value: "Create Test", hint: "Draft a new test" },
];

const POPUP_SLASH_ACTIONS = [
  { cmd: "/run",       action: "Run" as ActionType,         hint: "Start a test run" },
  { cmd: "/test",      action: "Create Test" as ActionType, hint: "Draft a new test" },
];

interface PopupMessage {
  id: string;
  role: "user" | "operator";
  content: string;
  streaming?: boolean;
}

interface HistorySession {
  id: string;
  title: string;
  time: string;
  pageLabel?: string | null;
}

function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type AtEntityType = 'run' | 'issue' | 'test' | 'suite';
interface AtResult { type: AtEntityType; id: string; displayLabel: string; subLabel: string; raw: any; }

export interface AskOperatorPanelProps {
  onClose: () => void;
  onMinimize: () => void;
  onExpand: (sessionId: string | null) => void;
  pageContext: PageContextEntry | null;
}

export function AskOperatorPanel({ onClose, onMinimize, onExpand, pageContext }: AskOperatorPanelProps) {
  const { popupView, setPopupView } = useContext(OperatorPageContext);

  const [value, setValue] = useState("");
  const [action, setAction] = useState<ActionType>("Auto");
  const [messages, setMessages] = useState<PopupMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState<string | null>(null);
  const [contextDismissed, setContextDismissed] = useState(false);
  const [skills, setSkills] = useState<any[]>([]);
  const [linkedContexts, setLinkedContexts] = useState<{ label: string; context: string }[]>([]);
  const [atSearch, setAtSearch] = useState<{ query: string; results: AtResult[]; anchor: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const atTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // History
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isNearBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => { operatorApi.getSkills().then(setSkills).catch(() => {}); }, []);

  useEffect(() => {
    if (popupView !== "history") return;
    setHistoryLoading(true);
    operatorApi.sessions()
      .then((list: any[]) => setHistorySessions(list.map(s => ({
        id: s.id,
        title: s.title || "New conversation",
        time: timeAgo(s.updatedAt || s.createdAt),
        pageLabel: s.pageLabel ?? null,
      }))))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [popupView]);

  const startNewChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setSessionId(null);
    setGeneratedTitle(null);
    setContextDismissed(false);
    setStreaming(false);
    setValue("");
    setPopupView("chat");
  };

  const loadSession = async (s: HistorySession) => {
    setPopupView("chat");
    setGeneratedTitle(s.title);
    setSessionId(s.id);
    setMessages([]);
    try {
      const session = await operatorApi.getSession(s.id);
      setMessages((session.messages ?? []).map((m: any) => ({
        id: m.id,
        role: m.role as "user" | "operator",
        content: m.content,
        streaming: false,
      })));
    } catch { /* start blank */ }
  };

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
    setTimeout(() => textRef.current?.focus(), 0);
  };

  const handleChange = (v: string) => {
    setValue(v);
    const cursor = textRef.current?.selectionStart ?? v.length;
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

  const sendMessage = async (content: string) => {
    if (!content.trim() || streaming) return;

    let sid = sessionId;
    if (!sid) {
      try {
        const session = await operatorApi.createSession(content.slice(0, 60), pageContext?.label ?? undefined);
        sid = session.id;
      } catch {
        sid = `local_${Date.now()}`;
      }
      setSessionId(sid);
    }

    const isFirst = messages.length === 0;
    const opMsgId = `op_${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", content },
      { id: opMsgId, role: "operator", content: "", streaming: true },
    ]);
    setStreaming(true);
    setValue("");
    const currentLinkedContexts = linkedContexts;
    setLinkedContexts([]);
    setAtSearch(null);

    if (isFirst) {
      operatorApi.generateTitle(sid!, content)
        .then((r: any) => setGeneratedTitle(r.title))
        .catch(() => setGeneratedTitle(content.trim().split(/\s+/).slice(0, 3).join(" ")));
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let opContent = "";

    // Pass page context as a separate field — injected server-side as a system message, never stored
    sendOperatorMessage(sid!, content, {
      onToken: (text) => {
        opContent += text;
        setMessages(prev => prev.map(m => m.id === opMsgId ? { ...m, content: opContent } : m));
      },
      onThinking: () => {},
      onComponent: () => {},
      onReset: () => {
        opContent = "";
        setMessages(prev => prev.map(m => m.id === opMsgId ? { ...m, content: "" } : m));
      },
      onDone: () => {
        setMessages(prev => prev.map(m => m.id === opMsgId ? { ...m, streaming: false } : m));
        setStreaming(false);
      },
      onError: (msg) => {
        setMessages(prev => prev.map(m =>
          m.id === opMsgId ? { ...m, content: opContent || `Something went wrong: ${msg}`, streaming: false } : m
        ));
        setStreaming(false);
      },
    }, ctrl.signal, {
      pageContext: !contextDismissed && pageContext ? pageContext.context : undefined,
      pageContexts: currentLinkedContexts.length > 0 ? currentLinkedContexts.map(c => c.context) : undefined,
    }).catch(() => { setStreaming(false); });
  };

  const go = (msg?: string) => sendMessage(msg ?? value);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setAtSearch(null); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); }
  };

  // Unified slash menu for popup
  const slashMenuOpen = value.startsWith('/') && !value.includes(' ') && value.length > 0;
  const slashFilter = slashMenuOpen ? value.slice(1).toLowerCase() : '';
  const matchFilter = (name: string, trigger: string) =>
    !slashFilter || trigger.toLowerCase().startsWith(slashFilter) || name.toLowerCase().includes(slashFilter);
  const popupSkillMatches = skills.filter((sk: any) => matchFilter(sk.name, sk.trigger));
  const popupActionMatches = POPUP_SLASH_ACTIONS.filter(s => matchFilter(s.cmd.slice(1), s.cmd.slice(1)));
  const popupHasMenu = popupSkillMatches.length > 0 || popupActionMatches.length > 0;

  const [size, setSize] = useState({ w: 360, h: 520 });
  const dragRef = useRef<{ edge: 'left' | 'top' | 'corner'; startX: number; startY: number; startW: number; startH: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = d.startX - e.clientX;
      const dy = d.startY - e.clientY;
      setSize(prev => ({
        w: d.edge !== 'top'   ? Math.max(300, Math.min(640, d.startW + dx)) : prev.w,
        h: d.edge !== 'left'  ? Math.max(360, Math.min(800, d.startH + dy)) : prev.h,
      }));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const startDrag = (edge: 'left' | 'top' | 'corner', e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { edge, startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };
  };

  const hasMessages = messages.length > 0;
  const isHistory = popupView === "history";

  return (
    <div
      className="fixed bottom-[34px] right-[42px] z-50 rounded-[12px] border border-border/50 shadow-2xl shadow-black/25 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200"
      style={{ width: size.w, height: size.h, background: "hsl(var(--sidebar-bg))" }}
    >
      {/* Resize handles */}
      <div className="absolute top-0 left-3 right-3 h-1 cursor-n-resize z-10" onMouseDown={e => startDrag('top', e)} />
      <div className="absolute left-0 top-3 bottom-3 w-1 cursor-w-resize z-10" onMouseDown={e => startDrag('left', e)} />
      <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-10" onMouseDown={e => startDrag('corner', e)} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 border border-border/40 rounded-[4px] px-1.5 py-0.5 tracking-wide uppercase shrink-0">Beta</span>
          <span className="text-[12.5px] font-semibold text-foreground truncate">
            {isHistory ? "Recent chats" : (generatedTitle ?? "New chat")}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {!isHistory && (
            <button
              onClick={startNewChat}
              title="New chat"
              className="p-1.5 rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => setPopupView(v => v === "history" ? "chat" : "history")}
            title={isHistory ? "Back to chat" : "Chat history"}
            className={cn(
              "p-1.5 rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              isHistory && "bg-muted text-foreground"
            )}
          >
            <Clock className="w-3 h-3" />
          </button>
          <button
            onClick={onMinimize}
            title="Minimize"
            className="p-1.5 rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            onClick={() => onExpand(sessionId)}
            title="Open full page"
            className="p-1.5 rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => { abortRef.current?.abort(); onClose(); }}
            title="Close"
            className="p-1.5 rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Body */}
      {isHistory ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {historyLoading ? (
            <p className="py-8 text-center text-[12px] text-muted-foreground">Loading…</p>
          ) : historySessions.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-muted-foreground">No previous chats yet.</p>
          ) : (() => {
            const currentLabel = pageContext?.label ?? null;
            const related = currentLabel ? historySessions.filter(s => s.pageLabel === currentLabel) : [];
            const rest = historySessions.filter(s => !currentLabel || s.pageLabel !== currentLabel);
            return (
              <div>
                {related.length > 0 && (
                  <>
                    <div className="px-4 pt-2.5 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">On this page</div>
                    <div className="divide-y divide-border/20 border-b border-border/20">
                      {related.map(s => (
                        <button
                          key={s.id}
                          onClick={() => loadSession(s)}
                          className="w-full flex flex-col items-start px-4 py-2.5 hover:bg-accent/10 transition-colors text-left"
                        >
                          <span className="text-[12.5px] font-medium text-foreground truncate w-full">{s.title}</span>
                          <span className="text-[11px] text-muted-foreground mt-0.5">{s.time}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {rest.length > 0 && (
                  <>
                    {related.length > 0 && <div className="px-4 pt-2.5 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recent</div>}
                    <div className="divide-y divide-border/20">
                      {rest.map(s => (
                        <button
                          key={s.id}
                          onClick={() => loadSession(s)}
                          className="w-full flex flex-col items-start px-4 py-2.5 hover:bg-muted/40 transition-colors text-left"
                        >
                          <span className="text-[12.5px] font-medium text-foreground truncate w-full">{s.title}</span>
                          <span className="text-[11px] text-muted-foreground mt-0.5">{s.time}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      ) : !hasMessages ? (
        <div className="flex flex-col items-center justify-center px-6 py-8 gap-3 text-center flex-1 overflow-y-auto custom-scrollbar">
          <div className="w-9 h-9 rounded-[8px] bg-muted/40 border border-border/40 flex items-center justify-center">
            <Command className="w-4 h-4 text-foreground/70" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-foreground">Welcome to Operator</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">Ask anything or tell Operator what you need</p>
          </div>

          <div className="flex flex-col items-center gap-1.5 mt-1 w-full">
            {QUICK_ACTIONS.map(qa => (
              <button
                key={qa.label}
                onClick={() => go(qa.label)}
                disabled={streaming}
                className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] border border-border/50 bg-muted/10 hover:bg-muted/40 hover:border-border/80 transition-colors text-[12px] text-foreground font-medium w-full max-w-[200px] justify-center disabled:opacity-50"
              >
                <span className="text-muted-foreground">{qa.icon}</span>
                {qa.label}
              </button>
            ))}
          </div>

          <div className="mt-1 space-y-1 text-[11px] text-muted-foreground/60">
            <div><span className="font-mono font-semibold text-muted-foreground/80 mr-1.5">/</span>skills and action shortcuts</div>
            <div><span className="font-mono font-semibold text-muted-foreground/80 mr-1.5">@</span>link a run, test, issue, or suite</div>
            <div><span className="font-mono font-semibold text-muted-foreground/80 mr-1.5">↩</span>new chat when switching topics</div>
          </div>
        </div>
      ) : (
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
          <div className="px-4 py-3 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "user" ? (
                  <div className="max-w-[80%] bg-muted/40 border border-border/40 rounded-[10px] px-3 py-2 text-[13px] text-foreground whitespace-pre-wrap">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[90%] text-[13px] text-foreground leading-relaxed prose-popup">
                    {msg.content ? (
                      <>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0 text-[13px] leading-relaxed">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="italic opacity-80">{children}</em>,
                            code: ({ children, className }) => {
                              const isBlock = className?.startsWith("language-");
                              return isBlock
                                ? <code className="block font-mono text-[11.5px] bg-muted/40 border border-border/30 rounded-[6px] px-3 py-2 my-1.5 whitespace-pre overflow-x-auto">{children}</code>
                                : <code className="font-mono text-[11px] bg-muted/50 border border-border/30 px-1 py-0.5 rounded text-foreground/90">{children}</code>;
                            },
                            pre: ({ children }) => <>{children}</>,
                            ul: ({ children }) => <ul className="my-1.5 pl-4 space-y-0.5 list-disc">{children}</ul>,
                            ol: ({ children }) => <ol className="my-1.5 pl-4 space-y-0.5 list-decimal">{children}</ol>,
                            li: ({ children }) => <li className="text-[13px] leading-relaxed">{children}</li>,
                            h1: ({ children }) => <h1 className="text-[14px] font-semibold mt-3 mb-1 first:mt-0">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-[13.5px] font-semibold mt-2.5 mb-1 first:mt-0">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-[13px] font-semibold mt-2 mb-0.5 first:mt-0">{children}</h3>,
                            a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2 hover:opacity-80 transition-opacity">{children}</a>,
                            hr: () => <hr className="border-border/30 my-3" />,
                          }}
                        >
                          {msg.content
                            .replace(/!\[.*?\]\(data:[^\)]*\)?/gs, "")
                            .replace(/!\[.*?\]\(data:[\s\S]*$/g, "")
                            .replace(/<[a-zA-Z][^>]*>[\s\S]*?<\/[a-zA-Z]+>/g, "")
                            .replace(/<[a-zA-Z][^>]*\/>/g, "")
                            .trim()}
                        </ReactMarkdown>
                        {msg.streaming && (
                          <span className="inline-block w-[3px] h-[13px] bg-foreground/40 ml-0.5 rounded-[1px] animate-pulse align-middle" />
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-[5px] py-1">
                        {[0, 1, 2].map(i => (
                          <span
                            key={i}
                            className="block w-[5px] h-[5px] rounded-full bg-foreground/50"
                            style={{ animation: `wavePopup 1.2s ease-in-out ${i * 0.15}s infinite` }}
                          />
                        ))}
                        <style>{`@keyframes wavePopup{0%,60%,100%{transform:translateY(0);opacity:.25}30%{transform:translateY(-4px);opacity:.85}}`}</style>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* Composer — hidden in history view */}
      {!isHistory && (
        <div className="px-3 pb-3 pt-2 shrink-0">
          {/* Unified slash menu */}
          {slashMenuOpen && popupHasMenu && (
            <div className="mb-1 border border-border/60 rounded-[8px] bg-background shadow-lg overflow-y-auto custom-scrollbar max-h-[200px]">
              {popupSkillMatches.length > 0 && (
                <>
                  <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/20">Skills</div>
                  {popupSkillMatches.map((sk: any) => (
                    <button
                      key={sk.id}
                      onMouseDown={e => { e.preventDefault(); setValue(sk.instruction); textRef.current?.focus(); }}
                      className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-accent text-[10px]">⚡</span>
                      <span className="text-[11px] font-mono text-foreground w-20 shrink-0">/{sk.trigger}</span>
                      <span className="text-[11px] text-muted-foreground truncate">{sk.name}</span>
                    </button>
                  ))}
                </>
              )}
              {popupActionMatches.length > 0 && (
                <>
                  <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/20 border-t border-t-border/20">Actions</div>
                  {popupActionMatches.map(s => (
                    <button
                      key={s.cmd}
                      onMouseDown={e => { e.preventDefault(); setValue(s.cmd + ' '); setAction(s.action); textRef.current?.focus(); }}
                      className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-muted-foreground text-[10px]">▶</span>
                      <span className="text-[11px] font-mono text-foreground w-20 shrink-0">{s.cmd}</span>
                      <span className="text-[11px] text-muted-foreground truncate">{s.hint}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          {/* @ entity search menu */}
          {atSearch && (
            <div className="mb-1 border border-border/60 rounded-[8px] bg-background shadow-lg overflow-y-auto custom-scrollbar max-h-[220px]">
              {atSearch.results.length === 0 ? (
                <div className="px-3 py-2.5 text-[11px] text-muted-foreground">
                  {atSearch.query.length === 0 ? "Type to search…" : "No results"}
                </div>
              ) : (
                (['run', 'issue', 'test', 'suite'] as AtEntityType[]).map(type => {
                  const group = atSearch.results.filter(r => r.type === type);
                  if (group.length === 0) return null;
                  const typeLabel = { run: 'Runs', issue: 'Issues', test: 'Tests', suite: 'Suites' }[type];
                  return (
                    <div key={type}>
                      <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/20 sticky top-0 bg-background">
                        {typeLabel}
                      </div>
                      {group.map(item => (
                        <button
                          key={item.id}
                          onMouseDown={e => { e.preventDefault(); selectAtResult(item); }}
                          className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left hover:bg-muted/50 transition-colors border-b border-border/10 last:border-0"
                        >
                          <span className="text-[11px] text-foreground truncate flex-1">{item.displayLabel}</span>
                          {item.subLabel && <span className="text-[10px] text-muted-foreground shrink-0">{item.subLabel}</span>}
                        </button>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          )}
          <div className="border border-border/40 rounded-[10px] overflow-hidden focus-within:border-border/70 transition-colors bg-muted/20 shadow-sm">
            {(pageContext && !contextDismissed || linkedContexts.length > 0) && (
              <div className="flex flex-wrap items-center gap-1 px-3 pt-2 pb-0">
                {pageContext && !contextDismissed && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5">
                    <span className="shrink-0 font-semibold">@</span>
                    <span className="truncate max-w-[160px]">{pageContext.label}</span>
                    <button
                      onClick={() => setContextDismissed(true)}
                      className="shrink-0 ml-0.5 text-accent/50 hover:text-accent transition-colors"
                      title="Remove context"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
                {linkedContexts.map((lc, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium text-accent bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5">
                    <span className="shrink-0 font-semibold">@</span>
                    <span className="truncate max-w-[130px]">{lc.label}</span>
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
              ref={textRef}
              value={value}
              onChange={e => {
                handleChange(e.target.value);
                e.currentTarget.style.height = "auto";
                e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 120) + "px";
              }}
              onKeyDown={handleKey}
              placeholder="Ask Operator…"
              rows={2}
              style={{ minHeight: "44px", maxHeight: "120px" }}
              className="w-full resize-none px-3 pt-2.5 pb-1 text-[13px] bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-2 px-2.5 pb-2 pt-0.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border/50 rounded-[4px] px-1.5 py-0.5 transition-colors">
                    {action} <ChevronDown className="w-2 h-2" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-44 surface-subtle border-border" side="top" align="start">
                  {ACTIONS.map(a => (
                    <DropdownMenuItem
                      key={a.value}
                      onClick={() => setAction(a.value)}
                      className="cursor-pointer flex items-center justify-between gap-3 text-[12px]"
                    >
                      <span>{a.value}</span>
                      {action === a.value && <Check className="w-3 h-3 shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                onClick={() => go()}
                disabled={!value.trim() || streaming}
                className="ml-auto w-6 h-6 flex items-center justify-center rounded-[5px] bg-foreground dark:bg-white/[0.04] dark:border dark:border-white/[0.12] text-background dark:text-foreground disabled:opacity-40 hover:opacity-80 dark:hover:bg-white/[0.08] transition-opacity"
              >
                {streaming ? (
                  <div className="w-3 h-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowUp className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Layout ──────────────────────────────────────────────

export function urlFallbackContext(location: string): PageContextEntry | null {
  if (location === "/overview")                  return { label: "Overview",        context: "Viewing the workspace Overview dashboard." };
  if (location === "/runs")                      return { label: "Runs",            context: "Viewing the Runs list." };
  if (location === "/issues")                    return { label: "Issues",          context: "Viewing the Issues list." };
  if (location === "/tests")                     return { label: "Tests",           context: "Viewing the Test Definitions library." };
  if (location === "/suites")                    return { label: "Suites",          context: "Viewing the Suites list." };
  if (location === "/settings")                  return { label: "Settings",        context: "Viewing workspace Settings." };
  if (location === "/events")                    return { label: "Events",          context: "Viewing the Events list." };
  if (location === "/operator" || location === "/" || location.startsWith("/chats")) return null;
  if (location === "/journeys") return { label: "User journeys", context: "Viewing the canonical user journey library. Use .traceback definitions and actual run evidence; fetch current records before making claims." };
  if (location.startsWith("/journeys/")) return { label: "Journey", context: `Viewing a canonical journey or route map at ${location}. Fetch the referenced canonical definition or map and its actual evidence.` };
  if (location === "/ontology") return { label: "Ontology", context: "Viewing the product ontology. Fetch the current canonical ontology before proposing changes." };
  if (location === "/ux") return { label: "UX evidence", context: "Viewing UX evidence. Analyze actual observations and distinguish synthetic findings from human validation." };
  if (location.startsWith("/personal")) return { label: "Project workspace", context: `Viewing ${location}. Keep evidence and actions scoped to the project referenced in this URL.` };
  if (location.startsWith("/runs/live"))         return { label: "Live Run",        context: "Watching a live test run in progress." };
  if (location.startsWith("/runs/initializing")) return { label: "Run Starting",    context: "A test run is initializing." };
  if (location.startsWith("/runs/"))             return { label: "Run Report",      context: `Viewing a run report (URL: ${location}).` };
  if (location.startsWith("/issues/"))           return { label: "Issue",           context: `Viewing an issue detail page (URL: ${location}).` };
  if (location.startsWith("/tests/"))            return { label: "Test",            context: `Viewing a test definition (URL: ${location}).` };
  if (location.startsWith("/suites/runs/"))      return { label: "Suite Run",       context: `Viewing a suite run report (URL: ${location}).` };
  if (location.startsWith("/suites/"))           return { label: "Suite",           context: `Viewing a suite detail page (URL: ${location}).` };
  if (location.startsWith("/events/"))           return { label: "Event",           context: `Viewing an event detail (URL: ${location}).` };
  return { label: "Workspace view", context: `Viewing ${location}. Fetch current workspace records before making claims or taking action.` };
}

export function Layout({ children, noScroll }: { children: React.ReactNode; noScroll?: boolean }) {
  const [location] = useLocation();
  const match = location.match(/^\/(tests|runs|suites|issues)\/([^/]+)$/);
  const record: any = match ? queryClient.getQueryData([{ tests:'test',runs:'run',suites:'suite',issues:'issue' }[match[1]]!,match[2]]) : null;
  const projectId = currentProjectId() || record?.projectId;
  const project = useQuery({queryKey:['personal-project',projectId],queryFn:()=>personal.getProject(projectId),enabled:!!projectId});
  const { popupOpen, popupMounted, setPopupOpen, setPopupMounted, setPopupView } = useContext(OperatorPageContext);

  const embedded = useContext(WorkspaceShellContext);
  if (embedded) return <div className={cn("min-h-0 flex-1", noScroll ? "h-full overflow-hidden flex flex-col" : "min-h-full")}>{children}</div>;
  if (projectId) return <PersonalWorkspaceLayout project={{id:projectId,name:project.data?.name||'Project',color:project.data?.color||'#888888'}}>{children}</PersonalWorkspaceLayout>;
  return (
    <div className="v2-team-layout flex h-screen w-full bg-background overflow-hidden text-foreground selection:bg-white/20 selection:text-foreground">
      <Sidebar mode="gui" onModeChange={() => window.location.assign("/")} />
      <nav className="v2-mobile-nav" aria-label="Workspace navigation" style={{display:"none",gap:16,padding:"12px 16px",overflowX:"auto",borderBottom:"1px solid hsl(var(--border))",fontSize:12}}>{[["/","Overview"],["/journeys","Journeys"],["/ux","UX"],["/operator","Operator"],["/tests","Tests"],["/runs","Runs"],["/suites","Suites"],["/issues","Issues"],["/personal","Projects"],["/settings","Settings"]].map(([href,label]) => <a key={href} href={href}>{label}</a>)}</nav>
      <main
        className="flex-1 relative flex flex-col min-w-0 bg-[hsl(var(--sidebar-bg))]"
        style={{ height: 'calc(100vh - 34px)' }}
      >
        <div
          className={cn("flex-1 w-full bg-background rounded-bl-[20px]", noScroll ? "overflow-hidden flex flex-col" : "overflow-y-auto custom-scrollbar")}
          style={{ boxShadow: "-1px 0 0 hsl(var(--border) / 0.15)" }}
        >
          {children}
        </div>
      </main>

      {/* Footer — z-20 so sidebar (z-30) sits on top of it */}
      <div className="fixed bottom-0 left-0 right-0 h-[34px] bg-[hsl(var(--sidebar-bg))] flex items-center px-4 gap-2 z-20">
        <div className="flex-1" />
        <button
          onClick={() => {
            if (!popupMounted) setPopupMounted(true);
            setPopupView("chat");
            setPopupOpen(o => !o);
          }}
          className={cn(
            "flex items-center gap-1.5 text-[12px] font-medium transition-colors rounded-[5px] px-2 py-0.5 -mx-2",
            popupOpen && popupMounted
              ? "text-foreground bg-muted/50"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Command className="w-3.5 h-3.5" />
          Ask Operator
        </button>
        <button
          onClick={() => {
            setPopupMounted(true);
            setPopupView("history");
            setPopupOpen(true);
          }}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors ml-1"
          title="Chat history"
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
