import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Plus, Search, CheckCircle2, XCircle, AlertTriangle, Pin, MoreHorizontal, Globe, Clock, Play } from "lucide-react";
import { NewProjectPopup } from "@/components/NewProjectPopup";
import { MOCK_PROJECTS, type Project } from "@/lib/personal-mock-data";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { personal as personalApi } from "@/lib/api";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PLAN_LIMIT = 5;

// Mini sparkline: last N run statuses as colored dots
function RunSparkline({ runs }: { runs: Project["recentRuns"] }) {
  // Pad to 7 slots
  const slots = Array.from({ length: 7 }, (_, i) => runs[i] ?? null);
  return (
    <div className="flex items-center gap-[3px]">
      {slots.map((run, i) => (
        <div
          key={i}
          className={cn(
            "w-[5px] h-[14px] rounded-[2px] transition-all",
            run === null
              ? "bg-border/50"
              : run.status === "passed"
              ? "bg-[#16a34a]/70"
              : run.status === "failed"
              ? "bg-destructive/70"
              : run.status === "warning"
              ? "bg-[#ca8a04]/70"
              : "bg-blue-500/70"
          )}
          title={run ? `${run.testName} · ${run.status} · ${run.timestamp}` : "No run"}
        />
      ))}
    </div>
  );
}

function StatusBadge({ project }: { project: Project }) {
  const failing = project.stats.failingTests > 0;
  if (failing) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
        <XCircle className="w-3 h-3" /> Failing
      </span>
    );
  }
  if (project.stats.totalRuns === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
        No runs yet
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#16a34a]/10 text-[#16a34a] border border-[#16a34a]/20">
      <CheckCircle2 className="w-3 h-3" /> Passing
    </span>
  );
}

function ProjectCard({
  project,
  onPin,
  onRename,
  onDelete,
}: {
  project: Project;
  onPin: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [, navigate] = useLocation();
  const href = `/personal/projects/${project.id}`;
  const lastRun = project.recentRuns[0];

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={() => navigate(href)}
          className="group relative flex flex-col cursor-pointer select-none rounded-[12px] border border-border bg-background hover:border-border transition-all duration-150 overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          {/* Color accent bar at top */}
          <div className="h-[3px] w-full shrink-0" style={{ background: project.color }} />

          <div className="flex flex-col flex-1 px-5 pt-4 pb-5 gap-4">
            {/* Row 1: name + status badge + menu */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-2 h-2 rounded-full shrink-0 mt-0.5"
                  style={{ background: project.color }}
                />
                <div className="min-w-0">
                  <h3
                    className="text-[15px] font-semibold text-foreground truncate leading-snug group-hover:text-foreground transition-colors"
                    style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.1px" }}
                  >
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span
                      className="text-[11px] text-muted-foreground font-mono truncate"
                    >
                      {project.baseUrl}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {project.pinned && (
                  <Pin className="w-3 h-3 text-muted-foreground/60 rotate-45" />
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={e => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-[5px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-44"
                    align="end"
                    onClick={e => e.stopPropagation()}
                  >
                    <DropdownMenuItem onClick={() => navigate(href)}>Open</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onPin(project.id)}>
                      {project.pinned ? "Unpin" : "Pin to top"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onRename(project.id)}>Rename</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/personal/projects/${project.id}/settings`)}>
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(project.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Row 2: stats row */}
            <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
              <StatusBadge project={project} />
              {project.stats.openIssues > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#ca8a04]">
                  <AlertTriangle className="w-3 h-3" />
                  {project.stats.openIssues} issue{project.stats.openIssues !== 1 ? "s" : ""}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
                <Play className="w-2.5 h-2.5" />
                {project.stats.totalRuns} runs
              </span>
            </div>

            {/* Row 3: sparkline + last active */}
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">Last 7 runs</span>
                <RunSparkline runs={project.recentRuns} />
              </div>

              <div className="text-right">
                {lastRun ? (
                  <>
                    <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[120px]">{lastRun.testName}</p>
                    <p className="text-[10px] text-muted-foreground/60 flex items-center justify-end gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" /> {lastRun.timestamp}
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground/60">No runs yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={() => navigate(href)}>Open</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onPin(project.id)}>
          {project.pinned ? "Unpin" : "Pin to top"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onRename(project.id)}>Rename</ContextMenuItem>
        <ContextMenuItem onClick={() => navigate(`/personal/projects/${project.id}/settings`)}>
          Settings
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDelete(project.id)}
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-24 text-center">
      {/* Illustrated grid placeholder */}
      <div className="relative w-[180px] h-[120px] mb-8">
        {[
          { x: 0, y: 0, w: 82, h: 52 },
          { x: 98, y: 0, w: 82, h: 52 },
          { x: 0, y: 68, w: 82, h: 52 },
          { x: 98, y: 68, w: 82, h: 52 },
        ].map((r, i) => (
          <div
            key={i}
            className="absolute rounded-[8px] border border-border bg-muted/30"
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
          >
            {/* Fake card lines */}
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[8px] bg-border/60" />
            <div className="absolute left-3 top-6 h-[6px] w-[40px] rounded bg-border/50" />
            <div className="absolute left-3 top-[36px] h-[4px] w-[28px] rounded bg-border/30" />
          </div>
        ))}
      </div>

      <h2
        className="text-[20px] font-semibold text-foreground"
        style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.3px" }}
      >
        No projects yet
      </h2>
      <p className="mt-2 text-[14px] text-muted-foreground max-w-[320px] leading-relaxed">
        Create a project for each app you want to test. Each one gets its own tests, runs, issues, and toolbox.
      </p>
      <button
        className="mt-6 btn-precision btn-primary flex items-center gap-1.5 text-[13px] px-4 py-2"
        onClick={onNew}
      >
        <Plus size={14} /> Create your first project
      </button>
    </div>
  );
}

export default function PersonalHome() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("last-active");
  const [showNewProject, setShowNewProject] = useState(false);

  const { data: projectsData, isLoading, isError, refetch } = useQuery({
    queryKey: ["personal-projects"],
    queryFn: () => personalApi.projects(),
  });

  // Map API data to Project shape; fall back to MOCK_PROJECTS if API is unavailable
  const projects: Project[] = useMemo(() => {
    if (!projectsData) return [];
    return projectsData.map((p: any) => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl ?? "",
      color: p.color ?? "#6366f1",
      pinned: p.pinned ?? false,
      createdAt: p.createdAt ?? new Date().toISOString(),
      lastActiveAt: p.lastActiveAt ?? new Date().toISOString(),
      stats: { totalRuns: p.stats?.totalRuns ?? 0, passingTests: p.stats?.passingTests ?? 0, failingTests: p.stats?.failingTests ?? 0, openIssues: p.stats?.openIssues ?? 0 },
      recentRuns: p.recentRuns ?? [],
      openIssues: p.openIssues ?? [],
    }));
  }, [projectsData]);

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => personalApi.updateProject(id, { pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal-projects"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => personalApi.deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal-projects"] }),
  });

  const isAtLimit = false;

  const filtered = useMemo(() => {
    let list = projects.filter(
      p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.baseUrl.toLowerCase().includes(search.toLowerCase())
    );
    if (sort === "name-asc") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "name-desc") list = [...list].sort((a, b) => b.name.localeCompare(a.name));
    else if (sort === "created") list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else list = [...list].sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
    return list;
  }, [projects, search, sort]);

  const pinned = filtered.filter(p => p.pinned);
  const rest = filtered.filter(p => !p.pinned);

  const handlePin = (id: string) => {
    const proj = projects.find(p => p.id === id);
    if (proj) pinMutation.mutate({ id, pinned: !proj.pinned });
  };

  const handleRename = (id: string) => {
    const name = window.prompt("New project name:");
    if (name?.trim())
      personalApi.updateProject(id, { name: name.trim() }).then(() => qc.invalidateQueries({ queryKey: ["personal-projects"] }));
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Delete this project? This cannot be undone."))
      deleteMutation.mutate(id);
  };

  const handleCreated = (_proj: { id: string; name: string; baseUrl: string; color: string }) => {
    qc.invalidateQueries({ queryKey: ["personal-projects"] });
  };

  const cardProps = { onPin: handlePin, onRename: handleRename, onDelete: handleDelete };

  if (isLoading) return <div className="v2-state" role="status">Loading projects…</div>;
  if (isError) return <div className="v2-state" role="alert"><h1>Projects unavailable</h1><button className="btn-precision btn-secondary" onClick={() => refetch()}>Retry</button></div>;
  return (
    <div className="min-h-full w-full flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-[960px]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-[24px] font-semibold text-foreground"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.4px" }}
            >
              Projects
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {projects.length === 0
                ? "Create a project to get started."
                : `${projects.length} project${projects.length !== 1 ? "s" : ""} · ${projects.filter(p => p.stats.failingTests > 0).length} failing · ${projects.reduce((s, p) => s + p.stats.openIssues, 0)} open issues`}
            </p>
          </div>
          <button
            className="btn-precision btn-primary flex items-center gap-1.5 text-[13px] px-4 py-2"
            onClick={() => setShowNewProject(true)}
          >
            <Plus size={14} /> New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <EmptyState onNew={() => setShowNewProject(true)} />
        ) : (
          <>
            {/* ── Search + sort ── */}
            <div className="flex items-center gap-3 mb-7">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  placeholder="Search projects..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 h-9 text-[13px] bg-transparent border border-border rounded-[8px] focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                />
              </div>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="h-9 px-3 text-[13px] bg-transparent border border-border rounded-[8px] focus:outline-none focus:border-primary text-foreground cursor-pointer"
              >
                <option value="last-active">Last active</option>
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="created">Date created</option>
              </select>
            </div>

            {/* ── Pinned ── */}
            {pinned.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <Pin className="w-3 h-3 text-muted-foreground/60 rotate-45" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                    Pinned
                  </span>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                  {pinned.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}
                </div>
              </div>
            )}

            {/* ── All projects ── */}
            {rest.length > 0 && (
              <div>
                {pinned.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                      All Projects
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                  {rest.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}
                </div>
              </div>
            )}

            {/* ── New project card ── */}
            {!isAtLimit && (
              <div className="mt-4">
                <button
                  onClick={() => setShowNewProject(true)}
                  className="w-full rounded-[12px] border border-dashed border-border/70 hover:border-border hover:bg-muted/30 transition-all duration-150 flex items-center justify-center gap-2 py-6 text-[13px] text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-4 h-4" /> New Project
                </button>
              </div>
            )}

            {/* ── No search results ── */}
            {filtered.length === 0 && search && (
              <div className="py-16 text-center text-[13px] text-muted-foreground">
                No projects matching <span className="font-mono">"{search}"</span>
              </div>
            )}
          </>
        )}
      </div>

      <NewProjectPopup
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        onCreated={handleCreated}
        isAtLimit={isAtLimit}
      />
    </div>
  );
}
