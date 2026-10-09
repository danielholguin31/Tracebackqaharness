import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {execFileSync} from 'node:child_process';
const temp=await mkdtemp(path.join(os.tmpdir(),'traceback-journey-qa-'));const port=Number(process.env.QA_JOURNEY_PORT||3105);const base=`http://127.0.0.1:${port}/api`;
const app=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,NODE_ENV:'development',PORT:String(port),TRACEBACK_PASSWORD:'',TRACEBACK_ROOT:path.join(temp,'.traceback'),DATABASE_URL:path.join(temp,'qa.db')},stdio:'ignore'});
const fixture=process.env.QA_FIXTURE_URL||'http://host.docker.internal:4010';
async function call(endpoint,method='GET',body,status=200){const r=await fetch(base+endpoint,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
async function waitFor(endpoint,terminal){for(let i=0;i<300;i++){const data=await call(endpoint);if(terminal.includes(data.status))return data;await new Promise(r=>setTimeout(r,200));}throw new Error('Timed out waiting for '+endpoint);}
try{
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'Isolated journey API starts');
 const j=await call('/journeys','POST',{id:'checkout',name:'Checkout confirmation',entryPoint:fixture,expectedOutcome:'Order confirmed',steps:[{order:0,type:'fill',target:'#email',value:'qa@example.test',css:true,action:'Enter fixture email'},{order:1,type:'click',target:'#submit',css:true,action:'Complete fixture order'},{order:2,type:'assert',target:'#result',value:'Order confirmed',css:true,action:'Check actual confirmation'}]},201);
 assert.equal(j.revision,1);assert.equal((await call('/journeys')).sourceOfTruth,'.traceback');
 await call('/journeys/checkout','PUT',{...j,name:'Updated checkout'},200);await call('/journeys/checkout','PUT',j,409);
 await call('/journeys/checkout/run','POST',{persona:'keyboard'},400);
 const created=await call('/journeys/checkout/run','POST',{persona:'mobile',budget:20},201);const run=await waitFor('/runs/'+created.runIds[0],['passed','failed','blocked']);assert.equal(run.status,'passed',run.keyFinding);assert.equal(run.viewport,'mobile');assert.ok(run.activityLog.some(l=>l.screenshotUrl));
 const analysis=await call('/journeys/checkout/analysis');assert.equal(analysis.coverage,'verified');assert.equal(analysis.runs[0].persona,'mobile');
 const mcp=new Client({name:'steel-evidence-qa',version:'1'});const transport=new StreamableHTTPClientTransport(new URL(base+'/mcp'));await mcp.connect(transport);try{const artifact=run.activityLog.find(l=>l.screenshotUrl).screenshotUrl.split('/').pop();const result=await mcp.callTool({name:'read_evidence_screenshot',arguments:{artifact}});assert.equal(result.content[0].type,'image');assert.equal(Buffer.from(result.content[0].data,'base64').subarray(1,4).toString(),'PNG');}finally{await mcp.close();await transport.close();}
 const cli=JSON.parse(execFileSync(process.execPath,['bin/traceback.mjs','--api',`http://127.0.0.1:${port}`,'journeys','get','checkout'],{encoding:'utf8'}));assert.equal(cli.id,'checkout');
 const current=await call('/journeys/checkout');await call('/journeys/checkout','PUT',{...current,expectedOutcome:'Changed expectation'},200);assert.equal((await call('/journeys/checkout/analysis')).coverage,'unverified');
 await call('/journeys','POST',{id:'failure',name:'Observed failure',entryPoint:fixture,expectedOutcome:'Impossible fixture text',steps:[{order:0,type:'assert',target:'h1',value:'Impossible fixture text',css:true,action:'Check deliberately absent text'}]},201);
 const failing=await call('/journeys/failure/run','POST',{},201);assert.equal((await waitFor('/runs/'+failing.runIds[0],['passed','failed','blocked'])).status,'failed');const plan=await call('/journeys/autofix','POST',{runId:failing.runIds[0]},201);assert.equal(plan.status,'awaiting-congruence-adapter');assert.equal(plan.policy.autoMerge,false);assert.ok(plan.failure.screenshots.length);
 const source=await call('/journeys/source-routes');assert.ok(source.routes.some(r=>r.path==='/journeys'));
 const map=await call('/journeys/maps','POST',{entryPoint:fixture,maxPages:2},202);const observed=await waitFor('/journeys/maps/'+map.id,['completed','blocked']);assert.equal(observed.status,'completed',observed.error);assert.equal(observed.pages.length,2);assert.ok(observed.pages.some(p=>p.heading==='Fixture help'));assert.ok(observed.truncated);
 const imported=await call('/journeys/maps/'+map.id+'/import','POST',{},200);assert.equal(imported.created.length,2);assert.ok(imported.created.every(j=>j.status==='draft'));assert.equal((await call('/journeys/maps/'+map.id+'/import','POST',{},200)).created.length,0);
 await call('/journeys/maps/missing', 'GET',undefined,404);await call('/journeys/maps/'+map.id+'/cancel','POST',{},409);await call('/journeys/github/sync','POST',{},503);
 const cancelled=await call('/journeys/maps','POST',{entryPoint:fixture,maxPages:20},202);await call('/journeys/maps/'+cancelled.id+'/cancel','POST',{},200);assert.equal((await waitFor('/journeys/maps/'+cancelled.id,['cancelled','blocked'])).status,'cancelled');
 console.log('PASS: canonical revisions, persona execution with real Steel screenshots, stale UX evidence, observed failure/fix plan, source route discovery, bounded browser mapping and idempotent draft import.');
}finally{app.kill('SIGTERM');await new Promise(resolve=>{if(app.exitCode!==null)resolve();else app.once('exit',resolve);});await rm(temp,{recursive:true,force:true});}
