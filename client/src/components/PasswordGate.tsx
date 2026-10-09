import { useState, useEffect } from 'react';
export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading'|'ready'|'login'|'error'>('loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => { setStatus('loading'); fetch('/api/auth/session').then(r => { if (!r.ok) throw new Error('Workspace service unavailable'); return r.json(); }).then(data => setStatus(data.authenticated ? 'ready' : 'login')).catch(() => setStatus('error')); };
  useEffect(load, []);
  if (status === 'ready') return <>{children}</>;
  if (status === 'loading') return <main className="v2-state" style={{minHeight:'100vh'}} role="status">Opening workspace…</main>;
  if (status === 'error') return <main className="v2-state" style={{minHeight:'100vh'}} role="alert"><h1>Workspace unavailable</h1><p>The API service could not be reached.</p><button className="btn-precision btn-secondary" onClick={load}>Retry</button></main>;
  return <main className="v2-state" style={{minHeight:'100vh'}}><div style={{maxWidth:360,width:'100%',textAlign:'left'}}><div className="v2-eyebrow">Traceback v2</div><h1>Open your workspace.</h1><p className="v2-hint">Enter your workspace access password.</p><form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { const r = await fetch('/api/auth/login',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}) }); const result=await r.json(); if (!r.ok) throw new Error(result.error); setStatus('ready'); setPassword(''); } catch(e) { setError(e instanceof Error ? e.message : 'Sign-in failed'); } finally {setBusy(false);} }}><label className="v2-label" htmlFor="workspace-password">Password</label><input id="workspace-password" className="v2-input" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} autoFocus required/>{error && <p className="v2-error" role="alert">{error}</p>}<button className="btn-precision btn-primary" style={{marginTop:16,width:'100%'}} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form></div></main>;
}
