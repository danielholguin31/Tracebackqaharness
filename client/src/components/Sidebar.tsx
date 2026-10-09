import { Link, useLocation } from 'wouter';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Plus, LayoutGrid, FileCheck, Play, Layers, Bug, Settings, Search, ToolCase, GitPullRequest, Network } from 'lucide-react';
import { operator } from '@/lib/api';
import { cn } from '@/lib/utils';

const navigation = [
  ['Overview','/overview',LayoutGrid], ['User journeys','/journeys',FileCheck],
  ['Ontology','/ontology',Network], ['UX evidence','/ux',Search],
  ['Test definitions','/tests',FileCheck], ['Runs','/runs',Play],
  ['Events','/events',GitPullRequest], ['Suites','/suites',Layers],
  ['Issues','/issues',Bug], ['Projects','/personal',LayoutGrid],
] as const;

export function Sidebar({ mode, onModeChange, onNavigate }: { mode: 'chats'|'gui'; onModeChange: (mode:'chats'|'gui')=>void; onNavigate?:()=>void }) {
  const [location,navigate]=useLocation();
  const [search,setSearch]=useState('');
  const projectBase=location.match(/^\/personal\/projects\/[^/]+/)?.[0];
  const sessions=useQuery({queryKey:['agent-sessions'],queryFn:operator.sessions,refetchInterval:5000});
  const newChat=()=>{window.dispatchEvent(new Event('traceback:new-chat'));navigate('/');onNavigate?.();};
  return <aside className="agent-sidebar flex h-full w-[248px] shrink-0 flex-col border-r border-border bg-[hsl(var(--sidebar-bg))] p-3" aria-label="Workspace sidebar">
    <Link href="/" onClick={onNavigate} className="flex items-center gap-2 px-2 py-3 text-sm font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background text-xs">T</span>Traceback</Link>
    <div className="my-3 grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1" role="group" aria-label="Sidebar view">
      {(['chats','gui'] as const).map(value=><button key={value} aria-pressed={mode===value} onClick={()=>onModeChange(value)} className={cn('flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium',mode===value?'bg-background text-foreground shadow-sm':'text-muted-foreground hover:text-foreground')}>{value==='chats'?<MessageSquare size={14}/>:<LayoutGrid size={14}/>} {value==='chats'?'Chats':'GUI'}</button>)}
    </div>
    <button onClick={newChat} className="mb-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"><Plus size={15}/>New chat</button>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {mode==='chats'?<>
        <label className="relative block mb-5"><Search size={14} className="absolute left-3 top-3 text-muted-foreground"/><input aria-label="Search chats" placeholder="Search chats" value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-md border border-border bg-transparent py-2 pl-9 pr-2 text-xs"/></label>
        <p className="px-2 mb-2 text-[11px] text-muted-foreground">Conversations</p>
        {sessions.isLoading?<p className="px-2 text-xs text-muted-foreground">Loading chats…</p>:sessions.isError?<p className="px-2 text-xs text-destructive">Could not load chats.</p>:null}
        {sessions.data?.filter(s=>(s.title||'New conversation').toLowerCase().includes(search.toLowerCase())).map(s=><Link key={s.id} href={`/chats/${s.id}`} onClick={onNavigate} className={cn('flex gap-2 items-center rounded-md px-2 py-2 text-xs hover:bg-muted',location===`/chats/${s.id}`&&'bg-muted')}><MessageSquare size={14} className="shrink-0 text-muted-foreground"/><span className="truncate">{s.title||'New conversation'}</span></Link>)}
        {sessions.data?.length===0&&<p className="px-2 text-xs leading-5 text-muted-foreground">Your conversations will appear here. Start with a QA goal.</p>}
      </>:<nav aria-label="GUI navigation" className="space-y-1">{navigation.map(([label,path,Icon])=><Link key={path} href={path} onClick={onNavigate} className={cn('flex items-center gap-2 rounded-md px-2 py-2 text-[13px] hover:bg-muted',location.startsWith(path)&&'bg-muted font-medium')}><Icon size={15} className="text-muted-foreground"/>{label}</Link>)}{projectBase&&<div className="mt-4 border-t border-border pt-3"><p className="px-2 pb-2 text-[11px] text-muted-foreground">Current project</p>{['overview','tests','runs','suites','issues','toolbox','settings'].map(section=><Link key={section} href={section==='overview'?projectBase:`${projectBase}/${section}`} onClick={onNavigate} className="block rounded-md px-2 py-2 text-xs capitalize hover:bg-muted">{section}</Link>)}</div>}</nav>}
    </div>
    <div className="mt-4 border-t border-border pt-3 space-y-1">{[['Toolbox','/tools',ToolCase],['Settings','/settings',Settings]] .map(([label,path,Icon]:any)=><Link key={path} href={path} onClick={onNavigate} className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-muted"><Icon size={14}/>{label}</Link>)}</div>
  </aside>;
}
