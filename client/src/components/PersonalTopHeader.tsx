import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  LayoutGrid, Briefcase, Settings, ChevronDown, Check,
  Users, CreditCard, Minus, Maximize2, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const workspaces = [
  { id: "1", name: "Traceback", type: "Team", color: "bg-[#3b82f6]", initial: "T" },
  { id: "2", name: "Personal", type: "Personal", color: "bg-[#6366f1]", initial: "P" },
];

const activeWs = workspaces.find((w) => w.type === "Personal")!;

const NAV = [
  { label: "Projects", path: "/personal", icon: LayoutGrid, exact: true },
  { label: "Toolbox", path: "/personal/toolbox", icon: Briefcase, exact: false },
  { label: "Settings", path: "/personal/settings", icon: Settings, exact: false },
];

export function PersonalTopHeader() {
  const [location, setLocation] = useLocation();
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // move sidebar and page layout when header is minimized
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.classList.toggle("header-collapsed", isMinimized);
    }
  }, [isMinimized]);

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed top-3 right-3 z-50 h-8 w-8 rounded-[10px] bg-background/88 border border-border/80 shadow-lg flex items-center justify-center"
        aria-label="Expand header"
      >
        <Maximize2 className="w-4 h-4 text-foreground" />
        <span className="sr-only">Expand header</span>
      </button>
    );
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 h-14 flex items-center px-4 backdrop-blur-md bg-background/70 border-b border-border/40"
      style={{ zIndex: 50 }}
    >
      {/* ── Workspace switcher (left) ── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/70 px-2 py-1.5 rounded-[8px] transition-colors outline-none shrink-0 mr-4">
            <div className={cn("w-6 h-6 rounded-[8px] flex items-center justify-center text-[12px] font-medium text-white shrink-0", activeWs.color)}>
              {activeWs.initial}
            </div>
            <span className="font-medium text-[14px] text-foreground">Personal</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[260px] surface-subtle border-border text-foreground p-1 rounded-[8px] shadow-sm"
          align="start"
          sideOffset={8}
        >
          {/* Workspace info */}
          <div className="px-3 py-3 flex gap-3 items-center">
            <div className={cn("w-10 h-10 rounded-[8px] flex items-center justify-center text-[18px] font-medium text-white shrink-0", activeWs.color)}>
              {activeWs.initial}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-[15px]">Personal</span>
                <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded-[8px] text-muted-foreground border border-border/50">Free</span>
              </div>
              <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground mt-1">
                <Users className="w-3.5 h-3.5" />
                <span>Just you</span>
                <span>•</span>
                <span>Owner</span>
              </div>
            </div>
          </div>

          <DropdownMenuSeparator className="bg-border my-1 mx-1" />

          <DropdownMenuItem
            onClick={() => setLocation("/personal/settings")}
            className="flex items-center gap-2.5 px-3 py-2 text-[14px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors outline-none rounded-[8px] my-0.5"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span>Settings</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setLocation("/usage")} className="flex items-center gap-2.5 px-3 py-2 text-[14px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors outline-none rounded-[8px] my-0.5">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <span>Usage & billing</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-border my-1 mx-1" />

          <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Switch Workspace
          </div>
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => { if (ws.type !== "Personal") setLocation("/"); }}
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors outline-none rounded-[8px]"
            >
              <div className={cn("w-5 h-5 rounded-[8px] flex items-center justify-center text-[10px] font-medium text-white shrink-0", ws.color)}>
                {ws.initial}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-medium truncate">{ws.name}</span>
                <span className="text-[11px] text-muted-foreground">{ws.type}</span>
              </div>
              {ws.type === "Personal" && <Check className="w-3.5 h-3.5 text-foreground shrink-0" />}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator className="bg-border my-1 mx-1" />
          <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted focus:bg-muted outline-none rounded-[8px]">
            <Plus className="w-3.5 h-3.5" />
            <span className="font-medium">Create new workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Nav items (centered absolutely) ── */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5">
        {NAV.map((item) => {
          const isActive = item.exact
            ? location === item.path
            : location.startsWith(item.path);
          return (
            <Link
              key={item.label}
              href={item.path}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <item.icon className="w-3.5 h-3.5" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Right: user avatar + minimize ── */}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setIsMinimized(true)}
          className="h-8 w-8 flex items-center justify-center rounded-[10px] border border-border/80 bg-muted/70 hover:bg-muted/90 transition-colors"
          aria-label="Minimize header"
        >
          <Minus className="w-3 h-3 text-foreground" />
          <span className="sr-only">Minimize header</span>
        </button>
        <div className="text-right hidden sm:block">
          <p className="text-[13px] font-medium text-foreground leading-none">Workspace owner</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">owner@localhost</p>
        </div>
        <div className="w-8 h-8 rounded-[8px] bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[12px] font-semibold text-white shrink-0 cursor-pointer hover:opacity-85 transition-opacity">
          WO
        </div>
      </div>
    </header>
  );
}
