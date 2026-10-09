import { test,expect } from '@playwright/test';
let projectId:string,testId:string,suiteId:string,runId:string;
test.beforeAll(async({request})=>{
 const project=await request.post('/api/personal/projects',{data:{name:`QA project ${Date.now()}`,baseUrl:'http://host.docker.internal:4010',color:'#5b8def'}});expect(project.ok()).toBeTruthy();projectId=(await project.json()).id;
 const definition=await request.post('/api/tests',{data:{name:`QA definition ${Date.now()}`,mode:'deterministic',entryPoint:'http://host.docker.internal:4010',steps:[{order:0,action:'Verify checkout fixture',type:'assert',target:'h1',value:'Checkout fixture',css:true}]}});expect(definition.ok()).toBeTruthy();testId=(await definition.json()).id;
 const suite=await request.post('/api/suites',{data:{name:`QA suite ${Date.now()}`,testIds:[testId]}});expect(suite.ok()).toBeTruthy();suiteId=(await suite.json()).id;
 const run=await request.post('/api/runs',{data:{testId}});expect(run.ok()).toBeTruthy();runId=(await run.json()).id;
});
test.afterAll(async({request})=>{await request.delete(`/api/tests/${testId}`);await request.delete(`/api/suites/${suiteId}`);await request.delete(`/api/personal/projects/${projectId}`);});
const routes=['/','/overview','/usage','/events','/events/missing','/tools','/tests/new/autonomous','/tests/new/deterministic','/tests','/tests/missing','/runs/initializing/missing','/runs/live/autonomous','/runs/live/deterministic','/runs/missing','/runs','/suites','/suites/new','/suites/missing','/suites/runs/missing','/issues','/issues/missing','/settings','/design-system','/workspaces/new','/operator','/personal/settings','/personal/toolbox','/personal','/personal/projects/missing','/personal/projects/missing/tests','/personal/unknown','/unknown'];
for(const route of routes)test(`route ${route}`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(route);await expect(page.locator('body')).not.toContainText('Opening workspace…',{timeout:10000});await expect(page.locator('body')).not.toBeEmpty();await page.waitForTimeout(150);expect(errors).toEqual([]);
 if(route.includes('missing'))await expect(page.locator('body')).toContainText(/unavailable|No run selected/i);
 if(route==='/runs')await expect(page.locator('body')).not.toContainText('__mock');
 if(route==='/unknown'||route==='/personal/unknown')await expect(page.locator('body')).toContainText('This page could not be found');
});
for(const section of ['','/tests','/runs','/issues','/suites','/settings','/toolbox'])test(`project ${section||'overview'}`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`/personal/projects/${projectId}${section}`);await expect(page.locator('body')).not.toContainText('Loading project…',{timeout:10000});await expect(page.locator('body')).not.toContainText('Project unavailable');expect(errors).toEqual([]);
});
test('created definitions and reports',async({page})=>{
 for(const route of [`/tests/${testId}`,`/suites/${suiteId}`,`/runs/${runId}`,`/runs/initializing/${runId}`,`/runs/live/autonomous?id=${runId}`,`/runs/live/deterministic?id=${runId}`]){const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(route);await expect(page.locator('body')).toContainText(/QA definition|QA suite/);expect(errors).toEqual([]);}
});
test('autonomous editor validates and saves all fields',async({page})=>{
 await page.goto('/tests/new/autonomous');await page.getByRole('button',{name:'Save test',exact:true}).click();await expect(page.getByRole('alert')).toContainText('valid starting URL');
 await page.getByLabel('Test name').fill('Browser editor persistence');await page.getByLabel('Starting URL').fill('http://host.docker.internal:4010');await page.getByLabel('Test goal').fill('Verify that the checkout fixture heading is visible.');await page.getByRole('button',{name:'Save test',exact:true}).click();await expect(page).toHaveURL(/\/tests\/[a-z0-9-]+$/);await expect(page.locator('body')).toContainText('Verify that the checkout fixture heading is visible.');
});
test('all run tabs retain actual results',async({page})=>{await page.goto(`/runs/${runId}`);await expect(page.getByRole('heading',{level:1})).toContainText('QA definition');await page.getByRole('button',{name:'report',exact:true}).click();await expect(page.locator('body')).toContainText('Run ID');await page.getByRole('button',{name:'issues',exact:true}).click();await expect(page.locator('body')).toContainText('Detected issues');await page.getByRole('button',{name:'trace',exact:true}).click();await expect(page.locator('body')).toContainText('Step timeline');});
test('project test list excludes team definitions',async({page})=>{await page.goto(`/personal/projects/${projectId}/tests`);await expect(page.locator('body')).not.toContainText(`QA definition`);});
test('API outage provides recovery',async({page})=>{await page.route('**/api/tests?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Service temporarily unavailable'})}));await page.goto('/tests');await expect(page.getByRole('alert')).toContainText('Could not load');await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();});
test('new project persists and opens an empty overview',async({page,request})=>{
 const name=`Project from UI ${Date.now()}`;await page.goto('/personal');await page.getByRole('button',{name:/New Project/i}).first().click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Name',{exact:true}).fill(name);await dialog.getByLabel('Base URL',{exact:true}).fill('http://host.docker.internal:4010');await dialog.getByRole('button',{name:/Create →/i}).click();await expect(page).toHaveURL(/\/personal\/projects\/[a-z0-9-]+$/);await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();const id=page.url().split('/').pop();const fetched=await request.get(`/api/personal/projects/${id}`);expect(fetched.ok()).toBeTruthy();await request.delete(`/api/personal/projects/${id}`);
});
