import { test, expect } from '@playwright/test';

test('agent is home, sidebar has Chats and GUI, and navigation preserves a draft', async ({page},testInfo) => {
  const mobile=testInfo.project.name==='mobile';
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'What should we test?'})).toBeVisible();
  const composer=page.getByPlaceholder('Give your agent a QA goal… or type / for commands');
  await composer.fill('Investigate checkout failures');
  if(mobile) await page.getByRole('button',{name:'Open sidebar',exact:true}).click();
  await page.getByRole('button',{name:'GUI',exact:true}).click();
  await page.getByRole('link',{name:'User journeys',exact:true}).click();
  await expect(page.getByRole('heading',{name:'User journeys',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ask agent about this view'}).click();
  await expect(composer).toHaveValue('Investigate checkout failures');
  await expect(page.getByText('User journeys',{exact:true})).toBeVisible();
  if(mobile) await page.getByRole('button',{name:'Open sidebar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Chats',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  if(mobile) await expect(page.getByRole('button',{name:'Close navigation'})).toHaveCount(0);
  await expect(composer).toHaveValue('');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('a saved chat opens in the workspace and remains available in GUI mode',async({page},testInfo)=>{
  await page.route('**/api/operator/sessions',route=>route.fulfill({json:[{id:'qa-sidebar-chat',title:'Investigate a journey'}]}));
  await page.route('**/api/operator/sessions/qa-sidebar-chat',route=>route.fulfill({json:{id:'qa-sidebar-chat',title:'Investigate a journey',messages:[{id:'qa-message',role:'user',content:'Inspect the actual checkout evidence'}]}}));
  await page.goto('/chats/qa-sidebar-chat');
  await expect(page.getByText('Inspect the actual checkout evidence',{exact:true})).toBeVisible();
  if(testInfo.project.name==='mobile')await page.getByRole('button',{name:'Open sidebar',exact:true}).click();
  await page.getByRole('button',{name:'GUI',exact:true}).click();
  await page.getByRole('link',{name:'Runs',exact:true}).click();
  await page.getByRole('button',{name:'Ask agent about this view'}).click();
  await expect(page.getByText('Inspect the actual checkout evidence',{exact:true})).toBeVisible();
});
