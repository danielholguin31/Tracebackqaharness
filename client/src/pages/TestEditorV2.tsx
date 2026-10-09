import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, GripVertical, ChevronDown, Play, Save } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { tests, runs, personal } from '@/lib/api';
import { useSetOperatorContext } from '@/contexts/OperatorPageContext';

type Step = { action: string; type: string; target: string; value: string; css: boolean };
const input = 'v2-input';
export default function TestEditorV2({ mode }: { mode: 'autonomous' | 'deterministic' }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const projectId = new URLSearchParams(window.location.search).get('projectId');
  const back = projectId ? `/personal/projects/${projectId}/tests` : '/tests';
  const [name, setName] = useState('Untitled Test');
  const [goal, setGoal] = useState('');
  const [url, setUrl] = useState('');
  const project = useQuery({queryKey:['personal-project',projectId],queryFn:()=>personal.getProject(projectId!),enabled:!!projectId});
  useEffect(()=>{if(project.data?.baseUrl)setUrl(current=>current||project.data.baseUrl);},[project.data]);
  const [environment, setEnvironment] = useState('staging');
  const [runnerMode, setRunnerMode] = useState('standard');
  const [viewports, setViewports] = useState(['desktop']);
  const [budget, setBudget] = useState(50);
  const [selfHealing, setSelfHealing] = useState(true);
  const [steps, setSteps] = useState<Step[]>([{ action: '', type: 'click', target: '', value: '', css: true }]);
  const [advanced, setAdvanced] = useState(false);
  const [openStep, setOpenStep] = useState<number | null>(0);
  const [error, setError] = useState('');
  const [estimate, setEstimate] = useState<{ credits: number; steps: number; breakdown: string } | null>(null);
  const updateStep = (index: number, patch: Partial<Step>) => setSteps(current => current.map((s, i) => i === index ? { ...s, ...patch } : s));
  const save = useMutation({
    mutationFn: async (dryRun: boolean) => {
      setError('');
      if (!name.trim()) throw new Error('Give this test a name.');
      let parsed: URL;
      try { parsed = new URL(url); } catch { throw new Error('Enter a valid starting URL.'); }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Use an HTTP or HTTPS URL.');
      if (!viewports.length) throw new Error('Select at least one viewport.');
      if (mode === 'autonomous' && !goal.trim()) throw new Error('Describe the goal and expected outcome.');
      if (mode === 'deterministic' && (!steps.length || steps.some(s => !s.action.trim()))) throw new Error('Describe every test step.');
      const test = await tests.create({ name, mode, projectId, entryPoint: url, environment, runnerMode, customPrompt: goal, estimatedCredits: budget, selfHealing: mode === 'deterministic' && selfHealing, viewport: viewports.length === 1 ? { mode: 'single', single: viewports[0] } : { mode: 'multi', multi: viewports }, defaultReports: ['standard'], triggers: { onPr: false, onDeploy: false, scheduled: false }, steps: mode === 'deterministic' ? steps.map((s, order) => ({ ...s, order })) : undefined });
      qc.invalidateQueries({ queryKey: ['tests'] });
      if (dryRun) { const run = await runs.create({ testId: test.id }); return `/runs/initializing/${run.id}`; }
      return `/tests/${test.id}`;
    }, onSuccess: destination => navigate(destination), onError: e => setError(e.message),
  });
  const estimation = useMutation({ mutationFn: () => tests.estimate({ goal: mode === 'autonomous' ? goal : steps.map(s => s.action).join('; '), mode, runnerMode, viewport: viewports }), onSuccess: setEstimate, onError: e => setError(e.message) });
  useSetOperatorContext({ label: `New ${mode} test`, context: `Creating ${mode} test ${name}. Goal: ${goal}. Entry point: ${url}.` });
  return <Layout><div className="v2-page">
    <Link href={back} className="v2-back"><ArrowLeft size={14} /> Back to test definitions</Link>
    <header className="v2-editor-header"><div><div className="v2-eyebrow">{mode} · new definition</div><input aria-label="Test name" className="v2-title-input" value={name} onChange={e => setName(e.target.value)} /><span className="v2-badge">Draft</span></div><div className="v2-actions"><button className="btn-precision btn-secondary" disabled={save.isPending} onClick={() => save.mutate(true)}><Play size={14} /> Save & dry run</button><button className="btn-precision btn-primary" disabled={save.isPending} onClick={() => save.mutate(false)}><Save size={14} />{save.isPending ? 'Saving…' : 'Save test'}</button></div></header>
    {error && <div role="alert" className="v2-error">{error}</div>}
    <div className="v2-editor-grid"><section>
      {mode === 'autonomous' ? <><label className="v2-eyebrow" htmlFor="test-goal">Test goal</label><textarea id="test-goal" className="v2-goal" value={goal} onChange={e => { setGoal(e.target.value); setEstimate(null); }} placeholder="A user should be able to sign up, verify their email, and complete checkout. Verify the order confirmation is visible." /><p className="v2-hint">Describe the user journey and what success looks like. The agent tests it in a real browser.</p></> : <><label className="v2-switch-row">Self-healing <input type="checkbox" checked={selfHealing} onChange={e => setSelfHealing(e.target.checked)} /></label><div className="v2-eyebrow">Test steps</div><div className="v2-step-list">{steps.map((step, index) => <div className="v2-step-editor" key={index}><div className="v2-step-row"><GripVertical size={14} aria-hidden="true" /><span className="font-mono">{index + 1}</span><input aria-label={`Step ${index + 1} description`} className={input} placeholder="Describe the action…" value={step.action} onChange={e => updateStep(index, { action: e.target.value })} /><button aria-label={`Configure step ${index + 1}`} aria-expanded={openStep === index} onClick={() => setOpenStep(openStep === index ? null : index)}>···</button><button aria-label={`Remove step ${index + 1}`} disabled={steps.length === 1} onClick={() => setSteps(s => s.filter((_, i) => i !== index))}><Trash2 size={14} /></button></div>{openStep === index && <div className="v2-step-fields"><label>Action<select className={input} value={step.type} onChange={e => updateStep(index, { type: e.target.value })}>{['click','fill','navigate','assert','wait','screenshot'].map(t => <option key={t}>{t}</option>)}</select></label><label>Target<input className={`${input} font-mono`} value={step.target} placeholder={step.type === 'navigate' ? '/checkout' : '#submit or visible text'} onChange={e => updateStep(index, { target: e.target.value })} /></label><label>Value<input className={input} value={step.value} onChange={e => updateStep(index, { value: e.target.value })} placeholder="Fill value or expected text" /></label><label className="v2-switch-row">Use CSS selector<input type="checkbox" checked={step.css} onChange={e => updateStep(index, { css: e.target.checked })} /></label></div>}</div>)}</div><button className="v2-text-button" onClick={() => { setSteps(s => [...s, { action: '', type: 'click', target: '', value: '', css: true }]); setOpenStep(steps.length); }}><Plus size={14} /> Add step</button><p className="v2-hint">Use explicit targets for repeatable tests. Natural-language steps require the configured AI model.</p></>}
      <button className="v2-disclosure" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>Advanced settings <ChevronDown size={14} /></button>{advanced && <div className="v2-property-group"><p className="v2-hint">Tests stay within their starting origin. Each run uses an isolated session. Repaired selectors are recorded for review and never silently overwrite your test.</p><label className="v2-label">Credit budget<input className={input} type="number" min={1} max={10000} value={budget} onChange={e => setBudget(Number(e.target.value))} /></label></div>}
    </section><aside className="v2-editor-rail"><section><div className="v2-eyebrow">Environment</div><div className="v2-segmented">{['production','staging','local'].map(env => <button key={env} aria-pressed={environment === env} onClick={() => setEnvironment(env)}>{env}</button>)}</div><label className="v2-label" htmlFor="starting-url">Starting URL</label><input id="starting-url" className={`${input} font-mono`} type="url" value={url} placeholder="https://app.example.com" onChange={e => setUrl(e.target.value)} /><p className="v2-hint">Local URLs must be reachable from the Steel service.</p></section>
      <section><div className="v2-eyebrow">Runner mode</div>{['fast','standard','deep'].map(modeName => <label key={modeName} className="v2-option"><input type="radio" name="runner" checked={runnerMode === modeName} onChange={() => { setRunnerMode(modeName); setEstimate(null); }} /><span>{modeName}</span><span className="v2-hint">{modeName === 'deep' ? '2' : '1'} cr/action</span></label>)}</section>
      <section><div className="v2-eyebrow">Viewports</div>{['desktop','tablet','mobile'].map(v => <label key={v} className="v2-option"><input type="checkbox" checked={viewports.includes(v)} onChange={e => setViewports(previous => e.target.checked ? [...previous, v] : previous.filter(p => p !== v))} />{v}</label>)}</section>
      <section><div className="v2-eyebrow">Triggers</div><p className="v2-hint">Manual runs are ready. PR, deploy, and schedule triggers require a connected runner deployment.</p></section>
      <section><div className="v2-eyebrow">Estimated cost</div><div className="v2-property-row"><span>Budget per viewport</span><strong className="font-mono">{budget} cr</strong></div>{estimate && <><div className="v2-property-row"><span>Estimated steps</span><span className="font-mono">{estimate.steps}</span></div><div className="v2-property-row"><span>Estimated total</span><span className="font-mono">{estimate.credits * viewports.length} cr</span></div><p className="v2-hint">{estimate.breakdown}</p></>}<button className="btn-precision btn-secondary" disabled={estimation.isPending} onClick={() => estimation.mutate()}>{estimation.isPending ? 'Estimating…' : 'Estimate cost'}</button><p className="v2-hint">Runs pause when they reach the budget. You can extend it or stop.</p></section>
    </aside></div>
  </div></Layout>;
}
