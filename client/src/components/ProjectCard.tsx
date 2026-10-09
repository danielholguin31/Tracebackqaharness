import { useLocation } from "wouter";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/personal-mock-data";

interface ProjectCardProps {
  project: Project;
  onPin: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onPin, onRename, onDelete }: ProjectCardProps) {
  const [, navigate] = useLocation();
  const href = `/personal/projects/${project.id}`;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={() => navigate(href)}
          className={cn(
            "flex items-center gap-3 px-5 py-5 cursor-pointer select-none",
            "rounded-[12px] border border-[hsl(var(--border))] bg-[hsl(var(--background))]",
            "transition-all duration-150",
            "hover:border-[hsl(var(--border-mid))] hover:bg-[hsl(var(--bg-subtle))]",
            "active:bg-[hsl(var(--bg-muted))]"
          )}
          style={{ minHeight: 80 }}
        >
          {/* Color dot */}
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
            style={{ background: project.color }}
          />

          {/* Text */}
          <div className="min-w-0 flex-1">
            <div
              className="text-[15px] font-semibold text-[hsl(var(--text-1))] truncate"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.1px" }}
            >
              {project.name}
            </div>
            <div
              className="text-[12px] text-[hsl(var(--text-3))] truncate mt-0.5"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {project.baseUrl}
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => navigate(href)}>Open</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onPin(project.id)}>
          {project.pinned ? "Unpin" : "Pin to Top"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onRename(project.id)}>Rename</ContextMenuItem>
        <ContextMenuItem onClick={() => navigate(`/personal/projects/${project.id}/settings`)}>
          Project Settings
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-[var(--fail-text)] focus:text-[var(--fail-text)]"
          onClick={() => onDelete(project.id)}
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
