import { Link, useLocation } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutGrid,
  FileCheck,
  Play,
  PlayCircle,
  Layers,
  Settings,
  ChevronDown,
  Search,
  Plus,
  Check,
  Bug,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  CreditCard,
  UserPlus,
  GitPullRequest,
  ToolCase,
  Command,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { runs as runsApi, issues as issuesApi, events as eventsApi } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle
} from "@/components/ui/dialog";
import { UsageModal } from "@/components/UsageModal";
import { RunTestSelector } from "@/components/RunTestSelector";
import {
  Tooltip,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

const workspaces = [
  { id: '1', name: "Traceback", type: "Team", color: "bg-[#3b82f6]", initial: "T" },
  { id: '2', name: "Personal", type: "Personal", color: "bg-[#6366f1]", initial: "P" },
];

const tooltipCls = "z-50 text-[11px] px-2 py-1 rounded-[6px] backdrop-blur-md bg-black/[0.07] dark:bg-white/[0.22] border border-black/[0.09] dark:border-white/[0.25] text-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 origin-[--radix-tooltip-content-transform-origin]";

function TooltipArrow() {
  return (
    <TooltipPrimitive.Arrow
      width={7}
      height={4}
      style={{ fill: "currentColor" }}
      className="text-black/[0.09] dark:text-white/[0.25]"
    />
  );
}

function SidebarTooltip({ label, enabled, children }: { label: string; enabled: boolean; children: React.ReactNode }) {
  if (!enabled) return <>{children}</>;
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side="right" sideOffset={8} className={tooltipCls}>
          {label}
          <TooltipArrow />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </Tooltip>
  );
}


const MIN_WIDTH = 160; // narrowest showing workspace name + collapse btn
const MAX_WIDTH = 228; // default expanded width

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try { return parseInt(localStorage.getItem('sidebar-width') || String(MAX_WIDTH)); } catch { return MAX_WIDTH; }
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const [usageOpen, setUsageOpen] = useState(false);
  const [location, setLocation] = useLocation();

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isCollapsed) return;
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    setIsDragging(true);

    let currentWidth = dragStartWidth.current;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      currentWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + delta));
      setSidebarWidth(currentWidth);
    };
    const onUp = () => {
      setIsDragging(false);
      try { localStorage.setItem('sidebar-width', String(currentWidth)); } catch {}
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [isCollapsed, sidebarWidth]);

  function collapse(val: boolean) {
    setIsCollapsed(val);
    try { localStorage.setItem('sidebar-collapsed', String(val)); } catch {}
  }

  // Collapse when a chat opens in Operator
  useEffect(() => {
    const handler = () => collapse(true);
    window.addEventListener("operator-chat-open", handler);
    return () => window.removeEventListener("operator-chat-open", handler);
  }, []);

  const [activeWorkspace, setActiveWorkspace] = useState("Traceback");
  const [isSwitchWorkspaceOpen, setIsSwitchWorkspaceOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [dropdownView, setDropdownView] = useState<'main' | 'switch'>('main');

  // Initialize theme tracking so it's correct right away
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else if (savedTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const activeWsInfo = workspaces.find(w => w.name === activeWorkspace) || workspaces[0];

  const { data: runsData } = useQuery({
    queryKey: ['sidebar-runs'],
    queryFn: () => runsApi.list({ status: 'running' }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const { data: issuesData } = useQuery({
    queryKey: ['sidebar-issues'],
    queryFn: () => issuesApi.list({ status: 'open' }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const { data: eventsData } = useQuery({
    queryKey: ['sidebar-events'],
    queryFn: () => eventsApi.list(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const liveRunsCount  = runsData?.total  ?? null;
  const openIssueCount = issuesData?.total ?? null;
  const eventsCount    = eventsData?.total ?? null;

  const navItems = [
    { name: "Overview",         path: "/",        icon: LayoutGrid },
    { name: "Operator",         path: "/operator",icon: Command },
    { name: "User journeys",    path: "/journeys",icon: FileCheck },
    { name: "UX evidence",      path: "/ux",      icon: Search },
    { name: "Test Definitions", path: "/tests",   icon: FileCheck },
    { name: "Runs",             path: "/runs",    icon: Play,          badge: liveRunsCount },
    { name: "Events",           path: "/events",  icon: GitPullRequest, badge: eventsCount },
    { name: "Suites",           path: "/suites",  icon: Layers },
    { name: "Issues",           path: "/issues",  icon: Bug,           badge: openIssueCount },
  ];

  const workspaceItems = [
    { name: "Toolbox", path: "/tools", icon: ToolCase },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  // Shared action button classes
  const actionBtnBase = "flex items-center transition-colors outline-none group";
  const actionBtnCollapsed = "w-10 h-10 justify-center mx-auto rounded-[8px] border border-border/50 dark:border-white/[0.12] dark:bg-white/[0.04] text-[hsl(var(--sidebar-fg-muted))] hover:text-[hsl(var(--sidebar-fg-active))] hover:bg-muted/50 hover:border-border/80 dark:hover:bg-white/[0.08] dark:hover:border-white/[0.2]";
  const actionBtnExpanded = "w-full gap-2.5 px-3 py-2 text-[13px] rounded-[8px] border border-border/50 dark:border-white/[0.12] dark:bg-white/[0.04] text-[hsl(var(--sidebar-fg-default))] hover:text-[hsl(var(--sidebar-fg-active))] hover:bg-muted/50 hover:border-border/80 dark:hover:bg-white/[0.08] dark:hover:border-white/[0.2]";

  return (
    <>
      <div
        className={cn("v2-team-sidebar flex flex-col h-screen bg-[hsl(var(--sidebar-bg))] shrink-0 font-sans z-30 relative overflow-hidden pt-[5px] pb-[5px]")}
        style={{
          width: isCollapsed ? 64 : sidebarWidth,
          transition: isDragging ? 'none' : 'width 220ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Drag resize handle */}
        {!isCollapsed && (
          <div
            onMouseDown={handleDragStart}
            className="absolute right-0 top-0 bottom-0 w-[4px] z-20 cursor-col-resize group"
          >
            <div className="absolute inset-y-0 right-0 w-[1px] bg-border/0 group-hover:bg-border/30 transition-colors duration-150" />
          </div>
        )}
        {/* Header */}
        <div className={cn("h-14 flex items-center border-b border-border/10 shrink-0", isCollapsed ? "justify-center px-0" : "px-3 gap-1")}>
          {!isCollapsed ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded-[8px] transition-colors outline-none flex-1 min-w-0">
                    <div className={cn("w-6 h-6 rounded-[8px] flex items-center justify-center text-[12px] font-medium text-white shrink-0", activeWsInfo.color)}>
                      {activeWsInfo.initial}
                    </div>
                    <span className="font-medium text-[14px] text-foreground truncate">{activeWorkspace}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[hsl(var(--sidebar-fg-muted))] shrink-0 ml-1" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[240px] bg-background border border-border/60 text-foreground p-1 rounded-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
                  align="start"
                  sideOffset={8}
                  onCloseAutoFocus={() => setDropdownView('main')}
                >
                  {dropdownView === 'main' ? (
                    <>
                      <div className="px-3 py-2.5 flex gap-2.5 items-center">
                        <div className={cn("w-7 h-7 rounded-[6px] flex items-center justify-center text-[12px] font-semibold text-white shrink-0", activeWsInfo.color)}>
                          {activeWsInfo.initial}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-[13px] text-foreground truncate">{activeWorkspace}</span>
                            <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded-[8px] text-muted-foreground border border-border/50 shrink-0">Pro</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                            <Users className="w-3 h-3" />
                            <span>5 seats · Owner</span>
                          </div>
                        </div>
                      </div>

                      <DropdownMenuSeparator className="bg-border/40 my-1" />

                      <DropdownMenuItem onClick={() => setLocation('/settings')} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors outline-none rounded-[8px]">
                        <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Settings</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors outline-none rounded-[8px]">
                        <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Invite members</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => setUsageOpen(true)} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors outline-none rounded-[8px]">
                        <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Usage</span>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="bg-border/40 my-1" />

                      <DropdownMenuItem
                        onSelect={e => { e.preventDefault(); setDropdownView('switch'); }}
                        className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors outline-none rounded-[8px] text-muted-foreground"
                      >
                        <span>Switch workspace</span>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-2.5 flex items-center gap-2">
                        <button
                          onClick={() => setDropdownView('main')}
                          className="p-1 rounded-[6px] hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[13px] font-medium text-foreground">Switch workspace</span>
                      </div>
                      <DropdownMenuSeparator className="bg-border/40 my-1" />
                      <div className="flex flex-col">
                        {workspaces.map(ws => (
                          <DropdownMenuItem
                            key={ws.id}
                            onSelect={e => { e.preventDefault(); if(ws.id==='2')window.location.assign('/personal');else{setActiveWorkspace(ws.name);setDropdownView('main');} }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors outline-none"
                          >
                            <div className={cn("w-7 h-7 rounded-[6px] flex items-center justify-center text-[12px] font-semibold text-white shrink-0", ws.color)}>
                              {ws.initial}
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-medium text-[13px] text-foreground truncate">{ws.name}</span>
                              <span className="text-[11px] text-muted-foreground">{ws.type}</span>
                            </div>
                            {activeWorkspace === ws.name && <Check className="w-3.5 h-3.5 text-foreground shrink-0" />}
                          </DropdownMenuItem>
                        ))}
                      </div>
                      <DropdownMenuSeparator className="bg-border/40 my-1" />
                      <DropdownMenuItem
                        onSelect={() => { setDropdownView('main'); setLocation('/workspaces/new'); }}
                        className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors outline-none rounded-[8px] text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New workspace</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                onClick={() => collapse(true)}
                className="p-1.5 text-[hsl(var(--sidebar-fg-muted))] hover:text-[hsl(var(--sidebar-fg-active))] hover:bg-muted/50 rounded-[8px] transition-colors flex items-center justify-center shrink-0 ml-auto"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <SidebarTooltip label={activeWorkspace} enabled={isCollapsed}>
              <div className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center text-[14px] font-medium text-white shrink-0 cursor-default", activeWsInfo.color)}>
                {activeWsInfo.initial}
              </div>
            </SidebarTooltip>
          )}
        </div>

        {isCollapsed && (
          <div className="flex justify-center mt-3 border-b border-border/10 pb-3 mx-2">
            <SidebarTooltip label="Expand sidebar" enabled={isCollapsed}>
              <button
                onClick={() => collapse(false)}
                className="w-10 h-10 text-[hsl(var(--sidebar-fg-muted))] hover:text-[hsl(var(--sidebar-fg-active))] hover:bg-muted/50 rounded-[8px] transition-colors flex items-center justify-center"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </SidebarTooltip>
          </div>
        )}

        {/* Action Buttons */}
        <div className={cn("mt-3 mb-4", isCollapsed ? "px-2 space-y-2" : "px-3 space-y-1.5")}>

          <Tooltip delayDuration={400}>
            <RunTestSelector
              trigger={
                <TooltipTrigger asChild>
                  <button className={cn(actionBtnBase, isCollapsed ? actionBtnCollapsed : actionBtnExpanded)}>
                    <PlayCircle className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>Run a test</span>}
                  </button>
                </TooltipTrigger>
              }
              align={isCollapsed ? "center" : "start"}
              side="right"
              sideOffset={8}
            />
            {isCollapsed && (
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content side="right" sideOffset={8} className={tooltipCls}>
                  Run a test
                  <TooltipArrow />
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            )}
          </Tooltip>

          <DropdownMenu>
            <Tooltip delayDuration={400}>
              <DropdownMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <button className={cn(actionBtnBase, isCollapsed ? actionBtnCollapsed : actionBtnExpanded)}>
                    <Plus className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>New Test Definition</span>}
                    {!isCollapsed && <kbd className="ml-auto font-sans text-[10px] text-[hsl(var(--sidebar-fg-muted))] opacity-0 group-hover:opacity-100 transition-opacity">C</kbd>}
                  </button>
                </TooltipTrigger>
              </DropdownMenuTrigger>
              {isCollapsed && (
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content side="right" sideOffset={8} className={tooltipCls}>
                    New test definition
                    <TooltipArrow />
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              )}
            </Tooltip>
            <DropdownMenuContent className="w-48 surface-subtle border-border text-foreground p-1 rounded-[8px]" align={isCollapsed ? "center" : "start"} side="right" sideOffset={8}>
              <div className="text-[11px] font-medium text-[hsl(var(--sidebar-fg-muted))] px-2 py-1.5 mb-1 uppercase tracking-wider">Create a Test Definition</div>
              <DropdownMenuItem
                onClick={() => setLocation('/tests/new/autonomous')}
                className="flex items-center gap-2 p-2 rounded-[8px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors outline-none text-[13px] font-medium"
              >
                Autonomous
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLocation('/tests/new/deterministic')}
                className="flex items-center gap-2 p-2 rounded-[8px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors mt-0.5 outline-none text-[13px] font-medium"
              >
                Deterministic
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 overflow-y-auto py-2 space-y-6">
          <nav className={cn("flex flex-col gap-0.5", isCollapsed ? "px-2" : "px-3")}>
            {navItems.map((item) => {
              const isActive = location === item.path || (item.path !== "/" && item.path !== "#" && location.startsWith(item.path));
              return (
                <SidebarTooltip key={item.name} label={item.name} enabled={isCollapsed}>
                  <Link
                    href={item.path}
                    className={cn(
                      "flex items-center rounded-[8px] relative group",
                      isCollapsed ? "justify-center w-10 h-10 mx-auto" : "gap-2.5 py-1.5 px-3 text-[13px]",
                      isActive
                        ? "bg-muted text-[hsl(var(--sidebar-fg-active))] font-medium"
                        : "sidebar-nav-link text-[hsl(var(--sidebar-fg-default))]"
                    )}
                  >
                    <item.icon strokeWidth={2} className={cn("w-4 h-4 transition-colors", isActive ? "text-foreground" : "text-[hsl(var(--sidebar-fg-muted))]")} />
                    {!isCollapsed && item.name}
                    {!isCollapsed && item.name === "Operator" && (
                      <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/60 border border-border/50 px-1.5 py-0.5 rounded-[4px]">beta</span>
                    )}
                    {!isCollapsed && item.badge != null && item.badge > 0 && item.name !== "Operator" && (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[11px] font-semibold tabular-nums bg-muted/80 text-muted-foreground border border-border/40">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </SidebarTooltip>
              );
            })}
          </nav>
        </div>

        {/* Footer Navigation */}
        <div className={cn("", isCollapsed ? "p-2 flex flex-col items-center gap-1" : "p-3 space-y-0.5")}>
          {!isCollapsed && <div className="border-t border-border/10 mx-5 mb-2" />}
          {workspaceItems.map((item) => {
            const isActive = location.startsWith(item.path);
            return (
              <SidebarTooltip key={item.name} label={item.name} enabled={isCollapsed}>
                <Link
                  href={item.path}
                  className={cn(
                    "flex items-center rounded-[8px] group",
                    isCollapsed ? "justify-center w-10 h-10" : "gap-2.5 px-3 py-1.5 text-[13px]",
                    isActive
                      ? "bg-muted text-[hsl(var(--sidebar-fg-active))] font-medium"
                      : "sidebar-nav-link text-[hsl(var(--sidebar-fg-default))]"
                  )}
                >
                  <item.icon strokeWidth={2} className={cn("w-4 h-4 transition-colors", isActive ? "text-foreground" : "text-[hsl(var(--sidebar-fg-muted))]")} />
                  {!isCollapsed && item.name}
                </Link>
              </SidebarTooltip>
            );
          })}

          {/* User Profile */}
          <SidebarTooltip label="Workspace owner" enabled={isCollapsed}>
            <div className={cn("pt-4 border-t border-border/10 flex items-center", isCollapsed ? "mt-2 justify-center w-full" : "mt-4 gap-3 px-2 w-full")}>
              <div className="w-8 h-8 rounded-[8px] bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[12px] font-medium text-primary-foreground shrink-0">
                WO
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground truncate">Workspace owner</div>
                  <div className="text-[11px] text-muted-foreground truncate">owner@localhost</div>
                </div>
              )}
            </div>
          </SidebarTooltip>
        </div>
      </div>

      {/* Switch Workspace Dialog */}
      <Dialog open={isSwitchWorkspaceOpen} onOpenChange={setIsSwitchWorkspaceOpen}>
        <DialogContent className="sm:max-w-[360px] p-0 overflow-hidden gap-0 rounded-[10px] border border-border/60 bg-background shadow-[0_8px_32px_rgba(0,0,0,0.12)]" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Switch Workspace</DialogTitle>
          <div className="px-4 py-3 border-b border-border/50">
            <h2 className="text-[13px] font-medium text-foreground">Switch workspace</h2>
          </div>
          <div className="p-1.5 flex flex-col max-h-[280px] overflow-y-auto custom-scrollbar">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => {
                  setActiveWorkspace(ws.name);
                  setIsSwitchWorkspaceOpen(false);
                  if (ws.type === "Personal") setLocation('/personal');
                }}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-[8px] transition-colors text-left w-full", activeWorkspace === ws.name ? "bg-muted/60" : "hover:bg-muted/40")}
              >
                <div className={cn("w-7 h-7 rounded-[6px] flex items-center justify-center text-[12px] font-semibold text-white shrink-0", ws.color)}>
                  {ws.initial}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-medium text-[13px] text-foreground truncate">{ws.name}</span>
                  <span className="text-[11px] text-muted-foreground">{ws.type}</span>
                </div>
                {activeWorkspace === ws.name && <Check className="w-3.5 h-3.5 text-foreground shrink-0" />}
              </button>
            ))}
          </div>
          <div className="p-1.5 border-t border-border/50">
            <button
              onClick={() => { setIsSwitchWorkspaceOpen(false); setIsCreateWorkspaceOpen(true); }}
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40 rounded-[8px] transition-colors text-left w-full text-[13px] text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New workspace</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateWorkspaceOpen} onOpenChange={setIsCreateWorkspaceOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden gap-0 rounded-[10px] border border-border/60 bg-background shadow-[0_8px_32px_rgba(0,0,0,0.12)]" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Create New Workspace</DialogTitle>
          <div className="px-4 py-3 border-b border-border/50">
            <h2 className="text-[13px] font-medium text-foreground">New workspace</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Set up a new space for your team or personal projects.</p>
          </div>

          <div className="p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">Name</label>
              <input
                type="text"
                className="h-8 w-full rounded-[8px] border border-border/60 bg-transparent px-3 text-[13px] text-foreground focus:outline-none focus:border-primary hover:border-border/80 transition-colors placeholder:text-muted-foreground/50"
                placeholder="e.g. Acme Corp"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">Type</label>
              <div className="relative">
                <select className="h-8 w-full appearance-none rounded-[8px] border border-border/60 bg-transparent pl-3 pr-8 text-[13px] text-foreground focus:outline-none focus:border-primary hover:border-border/80 transition-colors cursor-pointer">
                  <option value="team">Team</option>
                  <option value="personal">Personal</option>
                  <option value="agency">Agency</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-muted-foreground flex items-center justify-between">
                Invite people
                <span className="text-[11px] font-normal text-muted-foreground/60">Optional</span>
              </label>
              <textarea
                className="h-16 w-full rounded-[8px] border border-border/60 bg-transparent px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary hover:border-border/80 transition-colors resize-none placeholder:text-muted-foreground/50"
                placeholder="colleague@example.com, another@example.com"
              />
            </div>
          </div>

          <div className="px-4 py-3 border-t border-border/50 flex items-center justify-end gap-2">
            <button
              onClick={() => setIsCreateWorkspaceOpen(false)}
              className="btn-precision btn-secondary px-3 py-1.5 text-[13px]"
            >
              Cancel
            </button>
            <button
              onClick={() => setIsCreateWorkspaceOpen(false)}
              className="btn-precision btn-primary px-3 py-1.5 text-[13px]"
            >
              Create workspace
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <UsageModal isOpen={usageOpen} onClose={() => setUsageOpen(false)} />
    </>
  );
}
