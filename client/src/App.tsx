import { Switch, Route } from "wouter";
import { useContext } from "react";
import { useLocation } from "wouter";
import { OperatorPageContextProvider, OperatorPageContext } from "@/contexts/OperatorPageContext";
import { AskOperatorPanel, urlFallbackContext } from "@/components/Layout";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PasswordGate } from "@/components/PasswordGate";
import { PersonalWorkspaceLayout } from "@/layouts/PersonalWorkspaceLayout";
import { PersonalProjectShell } from "@/layouts/PersonalProjectShell";
import PersonalHome from "@/pages/personal/PersonalHome";
import { PersonalWorkspaceSettings } from "@/pages/personal/PersonalWorkspaceSettings";
import { PersonalWorkspaceToolbox } from "@/pages/personal/PersonalWorkspaceToolbox";
import NotFound from "@/pages/not-found";
import Overview from "@/pages/Overview";
import TestsLibrary from "@/pages/TestsLibrary";
import TestDetail from "@/pages/TestDetail";
import NewAutonomousTest from "@/pages/NewAutonomousTest";
import NewDeterministicTest from "@/pages/NewDeterministicTest";
import LiveRunAutonomous from "@/pages/LiveRunAutonomous";
import LiveRunDeterministic from "@/pages/LiveRunDeterministic";
import Runs from "@/pages/Runs";
import Suites from "@/pages/Suites";
import NewSuite from "@/pages/NewSuite";
import SuiteDetail from "@/pages/SuiteDetail";
import SuiteRunReport from "@/pages/SuiteRunReport";
import RunReport from "@/pages/RunReport";
import Issues from "@/pages/Issues";
import IssueDetail from "@/pages/IssueDetail";
import Settings from "@/pages/Settings";
import RunInitializing from "@/pages/RunInitializing";
import Usage from "@/pages/Usage";
import Events from "@/pages/Events";
import EventDetail from "@/pages/EventDetail";
import Toolbox from "@/pages/Toolbox";
import DesignSystem from "@/pages/DesignSystem";
import Operator from "@/pages/Operator";
import NewWorkspace from "@/pages/NewWorkspace";
import { JourneyLibrary,NewJourney,JourneyDetail,RouteMap,Ontology,UXEvidence } from '@/pages/Journeys';

// Single persistent popup instance — lives outside the per-page Layout tree
function OperatorPopupRoot() {
  const [location, navigate] = useLocation();
  const { pageContext, popupMounted, setPopupMounted, popupOpen, setPopupOpen } = useContext(OperatorPageContext);

  const effectiveContext = pageContext ?? urlFallbackContext(location);

  const handleExpand = (sessionId: string | null) => {
    if (sessionId) localStorage.setItem("operatorPendingSession", sessionId);
    if (effectiveContext) {
      localStorage.setItem("operatorPendingPageContext", effectiveContext.label);
      localStorage.setItem("operatorPendingPageContextContent", effectiveContext.context);
    }
    setPopupMounted(false);
    setPopupOpen(false);
    navigate("/operator");
  };

  if (!popupMounted || location === "/workspaces/new") return null;

  return (
    <div className={popupOpen ? "" : "hidden"}>
      <AskOperatorPanel
        onClose={() => { setPopupMounted(false); setPopupOpen(false); }}
        onMinimize={() => setPopupOpen(false)}
        onExpand={handleExpand}
        pageContext={effectiveContext}
      />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* ── Team workspace ── */}
      <Route path="/" component={Overview}/>
      <Route path="/journeys" component={JourneyLibrary}/>
      <Route path="/journeys/new" component={NewJourney}/>
      <Route path="/journeys/maps/:id">{p=><RouteMap id={p.id}/>}</Route>
      <Route path="/journeys/:id">{p=><JourneyDetail id={p.id}/>}</Route>
      <Route path="/ontology" component={Ontology}/>
      <Route path="/ux" component={UXEvidence}/>
      <Route path="/usage" component={Usage}/>
      <Route path="/events" component={Events}/>
      <Route path="/events/:id" component={EventDetail}/>
      <Route path="/tools" component={Toolbox}/>
      <Route path="/tests/new/autonomous" component={NewAutonomousTest}/>
      <Route path="/tests/new/deterministic" component={NewDeterministicTest}/>
      <Route path="/tests" component={TestsLibrary}/>
      <Route path="/tests/:id" component={TestDetail}/>
      <Route path="/runs/initializing/:id" component={RunInitializing}/>
      <Route path="/runs/live/autonomous" component={LiveRunAutonomous}/>
      <Route path="/runs/live/deterministic" component={LiveRunDeterministic}/>
      <Route path="/runs/:id" component={RunReport}/>
      <Route path="/runs" component={Runs}/>
      <Route path="/suites" component={Suites}/>
      <Route path="/suites/new" component={NewSuite}/>
      <Route path="/suites/:id" component={SuiteDetail}/>
      <Route path="/suites/runs/:id" component={SuiteRunReport}/>
      <Route path="/issues" component={Issues}/>
      <Route path="/issues/:id" component={IssueDetail}/>
      <Route path="/settings" component={Settings}/>
      <Route path="/design-system" component={DesignSystem}/>
      <Route path="/workspaces/new" component={NewWorkspace}/>
      <Route path="/operator" component={Operator}/>

      {/* ── Personal workspace — project sub-routes (must come before /personal) ── */}
      <Route path="/personal/projects/:id/tests">
        {(params) => <PersonalProjectShell projectId={params.id} />}
      </Route>
      <Route path="/personal/projects/:id/runs">
        {(params) => <PersonalProjectShell projectId={params.id} />}
      </Route>
      <Route path="/personal/projects/:id/issues">
        {(params) => <PersonalProjectShell projectId={params.id} />}
      </Route>
      <Route path="/personal/projects/:id/suites">
        {(params) => <PersonalProjectShell projectId={params.id} />}
      </Route>
      <Route path="/personal/projects/:id/toolbox">
        {(params) => <PersonalProjectShell projectId={params.id} />}
      </Route>
      <Route path="/personal/projects/:id/settings">
        {(params) => <PersonalProjectShell projectId={params.id} />}
      </Route>
      <Route path="/personal/projects/:id">
        {(params) => <PersonalProjectShell projectId={params.id} />}
      </Route>

      {/* ── Personal workspace — workspace-level pages ── */}
      <Route path="/personal/settings">
        {() => <PersonalWorkspaceLayout><PersonalWorkspaceSettings /></PersonalWorkspaceLayout>}
      </Route>
      <Route path="/personal/toolbox">
        {() => <PersonalWorkspaceLayout><PersonalWorkspaceToolbox /></PersonalWorkspaceLayout>}
      </Route>
      <Route path="/personal">
        {() => <PersonalWorkspaceLayout><PersonalHome /></PersonalWorkspaceLayout>}
      </Route>
      <Route path="/personal/:rest*">
        {() => <NotFound />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PasswordGate>
          <Toaster />
          <OperatorPageContextProvider>
            <Router />
            <OperatorPopupRoot />
          </OperatorPageContextProvider>
        </PasswordGate>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
