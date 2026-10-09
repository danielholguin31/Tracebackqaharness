import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  Settings,
  ChevronLeft,
  FileCheck,
  Play,
  Layers,
  Bug,
  Briefcase,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PROJECT_STORAGE_KEY = "tb_personal_project_sidebar";

interface PersonalSidebarProps {
  project: { id: string; name: string; color: string };
}

export function PersonalSidebar({ project }: PersonalSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(PROJECT_STORAGE_KEY);
      return saved !== null ? saved === "collapsed" : true;
    } catch {
      return true;
    }
  });

  const [location, setLocation] = useLocation();

  useEffect(() => {
    try {
      localStorage.setItem(PROJECT_STORAGE_KEY, isCollapsed ? "collapsed" : "open");
    } catch {}
  }, [isCollapsed]);

  const base = `/personal/projects/${project.id}`;
  const nav = [
    { name: "Tests",   path: `${base}/tests`,   icon: FileCheck },
    { name: "Runs",    path: `${base}/runs`,    icon: Play },
    { name: "Suites",  path: `${base}/suites`,  icon: Layers },
    { name: "Issues",  path: `${base}/issues`,  icon: Bug },
    { name: "Toolbox", path: `${base}/toolbox`, icon: Briefcase },
  ];
  const settingsPath = `${base}/settings`;

  return (
    <div
      className={cn(
        "personal-sidebar flex flex-col h-full bg-[hsl(var(--sidebar-bg))] border-r border-border shrink-0 transition-all duration-300",
        isCollapsed ? "w-14" : "w-[220px]"
      )}
    >
      {/* ── Header ── */}
      <div className={cn("h-12 flex items-center border-b border-border/50 shrink-0", isCollapsed ? "justify-center" : "px-3 gap-1")}>
        {!isCollapsed ? (
          <>
            <button
              onClick={() => setLocation("/personal")}
              className="flex items-center gap-2 flex-1 min-w-0 hover:bg-muted/60 px-1.5 py-1.5 rounded-[8px] transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="w-4 h-4 rounded-full shrink-0" style={{ background: project.color }} />
              <span className="text-[14px] font-medium text-foreground truncate">{project.name}</span>
            </button>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-[8px] transition-colors shrink-0"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="w-5 h-5 rounded-full shrink-0" style={{ background: project.color }} />
        )}
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <div className="flex justify-center pt-3 pb-2 border-b border-border/30">
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-9 h-9 flex items-center justify-center rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className={cn("flex flex-col gap-0.5 flex-1 py-3", isCollapsed ? "px-2" : "px-3")}>
        {nav.map((item) => {
          const isActive = location === item.path || location.startsWith(item.path + "/");
          return (
            <Link
              key={item.name}
              href={item.path}
              className={cn(
                "flex items-center rounded-[10px] transition-colors font-medium",
                isCollapsed
                  ? "justify-center w-10 h-10 mx-auto"
                  : "gap-3 px-3 py-2.5 text-[14px]",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <item.icon strokeWidth={2} style={{ width: 17, height: 17 }} className="shrink-0" />
              {!isCollapsed && item.name}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer: settings ── */}
      <div className={cn("border-t border-border/40 py-3", isCollapsed ? "px-2" : "px-3")}>
        {(() => {
          const isActive = location.startsWith(settingsPath);
          return (
            <Link
              href={settingsPath}
              className={cn(
                "flex items-center rounded-[10px] transition-colors font-medium",
                isCollapsed
                  ? "justify-center w-10 h-10 mx-auto"
                  : "gap-3 px-3 py-2.5 text-[14px]",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Settings strokeWidth={2} style={{ width: 17, height: 17 }} className="shrink-0" />
              {!isCollapsed && "Settings"}
            </Link>
          );
        })()}
      </div>
    </div>
  );
}
