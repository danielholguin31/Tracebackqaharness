import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('GitHub export preserves the base tree, publishes only canonical files, and discovers static remote routes',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'traceback-github-'));process.env.TRACEBACK_ROOT=path.join(temp,'.traceback');process.env.DATABASE_URL=path.join(temp,'qa.db');process.env.GITHUB_TOKEN='test-only-token';process.env.GITHUB_REPOSITORY='fixture/app';process.env.OPENAI_API_KEY='test-only-ai-key';
 const {tracebackStore}=await import('../server/lib/traceback-store');await tracebackStore.init();await tracebackStore.save({id:'checkout',name:'Checkout',entryPoint:'http://localhost:4010',expectedOutcome:'Checkout heading is visible',steps:[{order:0,type:'assert',action:'Check heading',target:'h1',css:true}]});
 const {syncCanonicalToGithub,discoverGithubRoutes}=await import('../server/lib/journey-github');const originalFetch=globalThis.fetch;const calls:any[]=[];
 globalThis.fetch=async(input:any,init:any={})=>{
  const endpoint=new URL(String(input)).pathname.replace('/repos/fixture/app','');const method=init.method||'GET';const body=init.body?JSON.parse(init.body):undefined;calls.push({endpoint,method,body});assert.equal(init.headers.Authorization,'Bearer test-only-token');let data:any;
  if(endpoint==='')data={full_name:'fixture/app',default_branch:'main'};
  else if(endpoint==='/git/ref/heads/main')data={object:{sha:'base-commit'}};
  else if(endpoint==='/git/commits/base-commit')data={tree:{sha:'base-tree'}};
  else if(endpoint==='/git/blobs'&&method==='POST')data={sha:'blob-'+calls.length};
  else if(endpoint==='/git/trees'&&method==='POST'){assert.equal(body.base_tree,'base-tree');assert.ok(body.tree.every((f:any)=>/^\.traceback\/(ontology\.json|journeys\/[a-z0-9-]+\/journey\.json)$/.test(f.path)));data={sha:'updated-tree'};}
  else if(endpoint==='/git/commits'&&method==='POST'){assert.deepEqual(body.parents,['base-commit']);data={sha:'updated-commit'};}
  else if(endpoint==='/git/refs'){assert.match(body.ref,/^refs\/heads\/traceback\/journeys-/);data={ref:body.ref};}
  else if(endpoint==='/pulls')data={html_url:'https://github.com/fixture/app/pull/1',number:1};
  else if(endpoint==='/git/trees/main')data={tree:[{type:'blob',path:'src/App.tsx',size:100,sha:'app'},{type:'blob',path:'app/settings/page.tsx',size:100,sha:'settings'}]};
  else if(endpoint==='/git/blobs/app')data={content:Buffer.from('<Route path="/checkout" />').toString('base64')};
  else if(endpoint==='/git/blobs/settings')data={content:Buffer.from('export default function Settings(){}').toString('base64')};
  else throw new Error('Unexpected GitHub request '+endpoint);
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 };
 try{assert.equal((await syncCanonicalToGithub()).number,1);assert.equal(calls.filter(x=>x.endpoint==='/git/blobs'&&x.method==='POST').length,2);const result=await discoverGithubRoutes();assert.deepEqual(result.routes.map(r=>r.path).sort(),['/checkout','/settings']);assert.ok(result.routes.every(r=>r.observed===false));
  const {inferJourneyDrafts}=await import('../server/lib/journey-inference');const {openai}=await import('../server/lib/openai');const create=openai.chat.completions.create;
  const mapId='00000000-0000-0000-0000-000000000001';await tracebackStore.write(`evidence/maps/${mapId}.json`,{status:'completed',pages:[{url:'http://localhost:4010/checkout',status:200,heading:'Checkout',links:[],controls:[]}]});
  try{
   (openai.chat.completions as any).create=async()=>({choices:[{message:{content:JSON.stringify({journeys:[{id:'hypothesis',name:'Checkout review',goal:'Review observed checkout or report missing prerequisites',expectedOutcome:'Observed heading is visible',routes:['/invented']}]})}}]});
   await assert.rejects(inferJourneyDrafts(mapId),/unobserved route/);
   (openai.chat.completions as any).create=async()=>({choices:[{message:{content:JSON.stringify({journeys:[{id:'hypothesis',name:'Checkout review',goal:'Review observed checkout or report missing prerequisites',expectedOutcome:'Observed heading is visible',routes:['/checkout']}]})}}]});
   const inferred=await inferJourneyDrafts(mapId);assert.equal(inferred.created[0].status,'draft');assert.equal(inferred.created[0].provenance.kind,'model-inference');assert.equal((await inferJourneyDrafts(mapId)).created.length,0);
   delete process.env.OPENAI_API_KEY;await assert.rejects(inferJourneyDrafts(mapId),/Configure OPENAI_API_KEY/);
  }finally{openai.chat.completions.create=create;}
 }
 finally{globalThis.fetch=originalFetch;await rm(temp,{recursive:true,force:true});}
});
