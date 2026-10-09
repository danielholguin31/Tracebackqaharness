import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
test('owner API requires a server session, blocks foreign origins, and accepts only live API keys',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'traceback-auth-'));
 const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'production',PORT:'3102',DATABASE_URL:path.join(temp,'qa.db'),TRACEBACK_PASSWORD:'test-only-workspace-password'},stdio:'ignore'});
 const base='http://127.0.0.1:3102/api';
 try{
  let ready=false;for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'Isolated API server started');
  assert.equal((await fetch(base+'/tests')).status,401);
  assert.equal((await fetch(base+'/artifacts/missing.png')).status,401);
  const bad=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'wrong'})});assert.equal(bad.status,401);
  const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'test-only-workspace-password'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')!.split(';')[0];assert.ok(login.headers.get('set-cookie')!.includes('HttpOnly'));
  assert.equal((await fetch(base+'/tests',{headers:{Cookie:cookie}})).status,200);
  const foreign=await fetch(base+'/workspace',{method:'PATCH',headers:{Cookie:cookie,Origin:'https://untrusted.example','Content-Type':'application/json'},body:JSON.stringify({name:'Changed'})});assert.equal(foreign.status,403);
  const response=await fetch(base+'/workspace/api-keys',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({name:'QA key'})});assert.equal(response.status,201);const key:any=await response.json();
  assert.equal((await fetch(base+'/tests',{headers:{Authorization:`Bearer ${key.key}`}})).status,200);
  const listed:any=await fetch(base+'/workspace/api-keys',{headers:{Cookie:cookie}}).then(r=>r.json());assert.ok(listed.every((k:any)=>!k.key&&!k.keyHash));
  assert.equal((await fetch(base+'/workspace/api-keys/'+key.id,{method:'DELETE',headers:{Cookie:cookie}})).status,200);
  assert.equal((await fetch(base+'/tests',{headers:{Authorization:`Bearer ${key.key}`}})).status,401);
  assert.equal((await fetch(base+'/workspace/members/user_dh',{method:'DELETE',headers:{Cookie:cookie}})).status,409);
 }finally{child.kill('SIGTERM');await new Promise<void>(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',()=>resolve());});await rm(temp,{recursive:true,force:true});}
});
