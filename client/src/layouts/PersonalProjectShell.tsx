import { useLocation } from "wouter";
import { PersonalWorkspaceLayout } from "./PersonalWorkspaceLayout";
import { PersonalProjectHome } from "@/pages/personal/PersonalProjectHome";
import { PersonalProjectSettings } from "@/pages/personal/PersonalProjectSettings";
import { PersonalProjectToolbox } from "@/pages/personal/PersonalProjectToolbox";
import PersonalProjectTests from "@/pages/personal/PersonalProjectTests";
import PersonalProjectRuns from "@/pages/personal/PersonalProjectRuns";
import PersonalProjectIssues from "@/pages/personal/PersonalProjectIssues";
import PersonalProjectSuites from "@/pages/personal/PersonalProjectSuites";
import { MOCK_PROJECTS } from "@/lib/personal-mock-data";
import { useQuery } from "@tanstack/react-query";
import { personal as personalApi } from "@/lib/api";

interface PersonalProjectShellProps {
  projectId: string;
}

export function PersonalProjectShell({ projectId }: PersonalProjectShellProps) {
  const [location] = useLocation();

  const { data: projectData, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["personal-project", projectId],
    queryFn: () => personalApi.getProject(projectId),
    enabled: !!projectId,
  });

  const fallback = MOCK_PROJECTS.find((p) => p.id === projectId) ?? {
    id: projectId,
    name: projectId,
    baseUrl: "",
    color: "#888",
    pinned: false,
    createdAt: "",
    lastActiveAt: "",
    stats: { totalRuns: 0, passingTests: 0, failingTests: 0, openIssues: 0 },
    recentRuns: [],
    openIssues: [],
  };

  const project = projectData ?? fallback;

  const projectMeta = { id: project.id, name: project.name, color: project.color };
  const base = `/personal/projects/${projectId}`;

  let content: React.ReactNode;
  if (location.startsWith(`${base}/tests`)) {
    content = <PersonalProjectTests />;
  } else if (location.startsWith(`${base}/runs`)) {
    content = <PersonalProjectRuns />;
  } else if (location.startsWith(`${base}/issues`)) {
    content = <PersonalProjectIssues />;
  } else if (location.startsWith(`${base}/suites`)) {
    content = <PersonalProjectSuites />;
  } else if (location.startsWith(`${base}/settings`)) {
    content = <PersonalProjectSettings project={project} />;
  } else if (location.startsWith(`${base}/toolbox`)) {
    content = <PersonalProjectToolbox project={project} />;
  } else {
    content = <PersonalProjectHome project={project} />;
  }

  if (isLoading) return <PersonalWorkspaceLayout><div className="v2-state" role="status">Loading project…</div></PersonalWorkspaceLayout>;
  if (isError || !projectData) return <PersonalWorkspaceLayout><div className="v2-state" role="alert"><h1>Project unavailable</h1><p>This project may have been deleted.</p><button onClick={() => refetch()} className="btn-precision btn-secondary">Retry</button><a href="/personal">All projects</a></div></PersonalWorkspaceLayout>;
  return (
    <PersonalWorkspaceLayout project={projectMeta}>
      {content}
    </PersonalWorkspaceLayout>
  );
}
