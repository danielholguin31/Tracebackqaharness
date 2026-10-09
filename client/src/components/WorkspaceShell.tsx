import { useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Menu, X, MessageSquare } from 'lucide-react';
import { Sidebar } from './Sidebar';
import AgentWorkspace from '@/pages/AgentWorkspace';
import { WorkspaceShellContext } from '@/contexts/WorkspaceShellContext';
import { OperatorPageContext } from '@/contexts/OperatorPageContext';
import { urlFallbackContext } from './Layout';

export function WorkspaceShell({children}:{children:React.ReactNode}) {
  const [location,navigate]=useLocation();
  useEffect(() => { const theme=localStorage.getItem('theme'); document.documentElement.classList.toggle('dark',theme==='dark'); }, []);
  const isChat=location==='/'||location==='/operator'||location.startsWith('/chats');
  const [mode,setMode]=useState<'chats'|'gui'>(()=>{try{return localStorage.getItem('workspace-sidebar-mode')==='gui'?'gui':'chats';}catch{return 'chats';}});
  const [drawer,setDrawer]=useState(false);
  const {pageContext}=useContext(OperatorPageContext);
  const changeMode=(value:'chats'|'gui')=>{setMode(value);localStorage.setItem('workspace-sidebar-mode',value);};
  const askAgent=()=>{const context=pageContext??urlFallbackContext(location);if(context){localStorage.setItem('operatorPendingPageContext',context.label);localStorage.setItem('operatorPendingPageContextContent',context.context);}navigate('/');window.dispatchEvent(new Event('traceback:agent-context'));changeMode('chats');};
  return <WorkspaceShellContext.Provider value={true}>
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <><div className="hidden md:flex"><Sidebar mode={mode} onModeChange={changeMode}/></div>{drawer&&<div className="fixed inset-0 z-50 flex md:hidden"><button aria-label="Close navigation" className="absolute inset-0 bg-black/30" onClick={()=>setDrawer(false)}/><div className="relative h-full"><Sidebar mode={mode} onModeChange={changeMode} onNavigate={()=>setDrawer(false)}/></div></div>}</>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:px-6"><div className="flex items-center gap-3"><button aria-label={drawer?'Close sidebar':'Open sidebar'} className="md:hidden" onClick={()=>setDrawer(!drawer)}>{drawer?<X size={18}/>:<Menu size={18}/>}</button><span className="text-xs text-muted-foreground">{isChat?'Agent workspace':'Workspace / GUI'}</span></div>{!isChat&&<button onClick={askAgent} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"><MessageSquare size={14}/>Ask agent about this view</button>}</header>
        <div className={isChat?'flex min-h-0 flex-1 flex-col':'hidden'}><AgentWorkspace/></div>
        {!isChat&&<div className="min-h-0 flex-1 overflow-y-auto">{children}</div>}
      </div>
    </div>
  </WorkspaceShellContext.Provider>;
}
