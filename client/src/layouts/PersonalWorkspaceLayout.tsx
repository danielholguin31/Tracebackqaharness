import { useContext } from 'react';
import { WorkspaceShellContext } from '@/contexts/WorkspaceShellContext';
import { PersonalSidebar } from "@/components/PersonalSidebar";
import { PersonalTopHeader } from "@/components/PersonalTopHeader";

interface PersonalWorkspaceLayoutProps {
  children: React.ReactNode;
  project?: { id: string; name: string; color: string };
}

export function PersonalWorkspaceLayout({ children, project }: PersonalWorkspaceLayoutProps) {
  const embedded = useContext(WorkspaceShellContext);
  if (embedded) return <div className="min-h-full">{children}</div>;
  return (
    <div className="personal-workspace-layout h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Floating glassmorphism header — fixed over everything */}
      <PersonalTopHeader />

      {/* Body starts below the fixed header (h-14 = 56px) */}
      <div className="personal-workspace-body flex h-full pt-14">
        {project && <PersonalSidebar project={project} />}
        {project && <nav className="v2-personal-mobile-nav" aria-label="Project navigation">{[["/personal","Projects"],[`/personal/projects/${project.id}`,"Overview"],...["tests","runs","suites","issues","settings"].map(s=>[`/personal/projects/${project.id}/${s}`,s])].map(([href,label])=><a key={href} href={href}>{label}</a>)}</nav>}
        <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
