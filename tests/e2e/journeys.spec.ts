import { test, expect } from "@playwright/test";
import { rm } from "node:fs/promises";
import path from "node:path";
let id: string;
let originalOntology: any;
const cleanup = new Set<string>();
test.beforeAll(async ({ request }) => {
  id = "qa-canonical-" + Date.now();
  cleanup.add(id);
  originalOntology = await request
    .get("/api/journeys/ontology")
    .then((r) => r.json());
  const result = await request.post("/api/journeys", {
    data: {
      id,
      name: "Canonical fixture journey",
      entryPoint: "http://host.docker.internal:4010",
      expectedOutcome: "Checkout fixture heading is visible",
      steps: [
        {
          order: 0,
          type: "assert",
          target: "h1",
          value: "Checkout fixture",
          css: true,
          action: "Inspect the fixture heading",
        },
      ],
    },
  });
  expect(result.status()).toBe(201);
});
test.afterAll(async ({ request }) => {
  for (const value of cleanup) {
    expect(value).toMatch(/^(qa-|route-host-docker-internal-4010-)/);
    await rm(
      path.resolve(
        process.env.TRACEBACK_ROOT || ".traceback",
        "journeys",
        value,
      ),
      { recursive: true, force: true },
    );
  }
  await request.put("/api/journeys/ontology", { data: originalOntology });
});
for (const route of [
  "/journeys",
  "/journeys/new",
  "/journeys/missing",
  "/journeys/maps/missing",
  "/ontology",
  "/ux",
])
  test(`canonical route ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(route);
    await expect(page.locator("h1:visible")).toBeVisible();
    await page.waitForTimeout(150);
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    if (route.includes("missing"))
      await expect(page.getByRole("alert")).toBeVisible();
  });
test("journey editor persists intent, validates JSON, and exposes current revision", async ({
  page,
  request,
}) => {
  const createdId = "qa-editor-" + Date.now();
  cleanup.add(createdId);
  await page.goto("/journeys/new");
  await page.getByLabel("Journey ID", { exact: true }).fill(createdId);
  await page.getByLabel("Name", { exact: true }).fill("Journey from browser");
  await page
    .getByLabel("Starting URL")
    .fill("http://host.docker.internal:4010");
  await page
    .getByLabel("Expected outcome")
    .fill("Checkout fixture heading is visible");
  await page.getByLabel("Step definitions (JSON)").fill("[invalid");
  await page
    .getByRole("button", { name: "Create journey", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("could not finish");
  await page
    .getByLabel("Step definitions (JSON)")
    .fill(
      JSON.stringify([
        {
          order: 0,
          type: "assert",
          action: "Check fixture heading",
          target: "h1",
          value: "Checkout fixture",
          css: true,
        },
      ]),
    );
  await page
    .getByRole("button", { name: "Create journey", exact: true })
    .click();
  await expect(page).toHaveURL("/journeys/" + createdId);
  await expect(page.locator("body")).toContainText("revision 1");
  await page.getByRole("tab", { name: "Definition", exact: true }).click();
  await page.getByLabel("Expected outcome").fill("Updated expected outcome");
  await page.getByRole("button", { name: "Save revision" }).click();
  await expect(page.locator("body")).toContainText("revision 2");
  const canonical = await request
    .get("/api/journeys/" + createdId)
    .then((r) => r.json());
  expect(canonical.expectedOutcome).toBe("Updated expected outcome");
});
test("a stale editor refuses to overwrite a newer canonical definition", async ({
  page,
  request,
}) => {
  await page.goto("/journeys/" + id);
  await page.getByRole("tab", { name: "Definition", exact: true }).click();
  const original = await request
    .get("/api/journeys/" + id)
    .then((r) => r.json());
  await request.put("/api/journeys/" + id, {
    data: { ...original, description: "Concurrent revision" },
  });
  await page.getByLabel("Expected outcome").fill("Stale edit");
  await page.getByRole("button", { name: "Save revision" }).click();
  await expect(page.getByRole("alert")).toContainText("changed");
});
test("run a canonical mobile profile and inspect actual UX evidence", async ({
  page,
}) => {
  await page.goto("/journeys/" + id);
  await page.getByLabel("Browser profile").selectOption("mobile");
  await page.getByRole("button", { name: "Run journey", exact: true }).click();
  await expect(page).toHaveURL(/\/runs\/[a-z0-9-]+/);
  await expect(page.locator("body")).toContainText(
    "All defined checks passed",
    { timeout: 30000 },
  );
  await page.goto("/journeys/" + id);
  await expect(page.locator("body")).toContainText(
    "Current revision has passing evidence",
  );
  await expect(page.locator("body")).toContainText("mobile · passed");
  await expect(
    page.getByRole("link", { name: "Ask agent" }),
  ).toHaveAttribute("href", /journey=qa-canonical/);
});
test("source discovery and ontology edits have real save and validation behavior", async ({
  page,
}) => {
  await page.goto("/journeys");
  await page.getByRole("button", { name: "Discover source routes" }).click();
  await expect(page.locator(".journey-route-list")).toContainText("/journeys");
  await page.getByRole("button", { name: "Save routes to ontology" }).click();
  await expect(page.getByRole("status")).toContainText("Static routes saved");
  await page.goto("/ontology");
  await page.getByLabel("Ontology JSON").fill("{invalid");
  await page.getByRole("button", { name: "Save ontology" }).click();
  await expect(page.getByRole("alert")).toContainText("could not finish");
  await page.getByLabel("Ontology JSON").fill(JSON.stringify(originalOntology));
  await page.getByRole("button", { name: "Save ontology" }).click();
  await expect(page.getByRole("status")).toContainText("Ontology saved");
});
test("map a real fixture and import reviewed draft checks", async ({
  page,
  request,
}) => {
  await page.goto("/journeys");
  await page
    .getByLabel("Application URL")
    .fill("http://host.docker.internal:4010");
  await page.getByLabel("Page limit").fill("2");
  await page.getByRole("button", { name: "Start browser map" }).click();
  await expect(page).toHaveURL(/\/journeys\/maps\/[a-z0-9-]+/);
  await expect(
    page.getByRole("button", { name: "Import draft journeys" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator("body")).toContainText("Fixture help");
  await page.getByRole("button", { name: "Import draft journeys" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "These drafts" }),
  ).toBeVisible();
  const all = await request.get("/api/journeys").then((r) => r.json());
  for (const j of all.items.filter(
    (j: any) =>
      j.provenance.kind === "observed-link" &&
      j.entryPoint.startsWith("http://host.docker.internal:4010"),
  ))
    cleanup.add(j.id);
});
test("canonical API outage offers recovery", async ({ page }) => {
  await page.route("**/api/journeys?q=*", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporary canonical service outage" }),
    }),
  );
  await page.goto("/journeys");
  await expect(page.getByRole("alert")).toContainText("Temporary canonical");
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
});
test('search, unavailable AI inference, and configured GitHub controls give concrete results',async({page,request})=>{
 await page.goto('/journeys');await page.getByLabel('Search journeys and evidence').fill('Canonical fixture');await expect(page.locator('body')).toContainText('Matching runtime evidence');await expect(page.locator('.journey-row').filter({hasText:'Canonical fixture journey'}).first()).toBeVisible();
 await page.route('**/api/journeys/github',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({configured:true,repository:'fixture/app'})}));await page.route('**/api/journeys/github/routes',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({routes:[{path:'/fixture-route',source:'fixture/App.tsx',observed:false}],filesInspected:1,truncated:false})}));await page.route('**/api/journeys/github/sync',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({url:'https://github.com/fixture/app/pull/1'})}));await page.goto('/journeys');await page.getByRole('button',{name:'Discover GitHub routes'}).click();await expect(page.locator('.journey-route-list')).toContainText('/fixture-route');await page.getByRole('button',{name:'Create journey PR'}).click();await expect(page.getByRole('status')).toContainText('Journey PR created');
 const capabilities=await request.get('/api/capabilities').then(r=>r.json());if(!capabilities.ai){const job=await request.post('/api/journeys/maps',{data:{entryPoint:'http://host.docker.internal:4010',maxPages:1}}).then(r=>r.json());await page.goto('/journeys/maps/'+job.id);await expect(page.getByRole('button',{name:'Infer journey hypotheses'})).toBeVisible({timeout:30000});await page.getByRole('button',{name:'Infer journey hypotheses'}).click();await expect(page.getByRole('alert')).toContainText('OPENAI_API_KEY');}
});
test('journey surfaces keep readable contrast and fit tablet in both themes',async({page})=>{
 await page.setViewportSize({width:768,height:1000});for(const theme of ['light','dark']){await page.addInitScript(value=>localStorage.setItem('theme',value),theme);await page.goto('/journeys');await expect(page.getByRole('heading',{name:'User journeys',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();const ratio=await page.locator('.journey-note').first().evaluate(el=>{const rgb=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number);const luminance=(v:number[])=>v.map(x=>{const n=x/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);const fg=luminance(rgb(getComputedStyle(el).color));const bg=luminance(rgb(getComputedStyle(document.body).backgroundColor));return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);});expect(ratio).toBeGreaterThanOrEqual(4.5);await page.getByLabel('Search journeys and evidence').focus();await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement?.tagName)).not.toBe('BODY');}
});
test("OpenIntelligentUI artifact isolation blocks host access and verifies bridge senders", async ({
  page,
}) => {
  await page.route("**/api/operator/sessions/qa-artifact", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "qa-artifact",
        title: "Sandbox test",
        messages: [
          {
            id: "m1",
            role: "operator",
            content: "Fixture artifact",
            components: [
              {
                type: "custom_component",
                data: {
                  title: "Sandboxed evidence",
                  html: `<h2>Isolated evidence</h2><button onclick="sendPrompt('Review this observation')">Review observation</button><script>try{parent.document.body.dataset.compromised='yes'}catch(e){document.body.dataset.blocked='yes'}</script>`,
                },
              },
            ],
          },
        ],
      }),
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("operatorPendingSession", "qa-artifact"),
  );
  await page.goto("/operator");
  const frame = page.frameLocator('iframe[title="Sandboxed evidence"]');
  await expect(
    frame.getByRole("heading", { name: "Isolated evidence" }),
  ).toBeVisible();
  expect(
    await page.locator("body").getAttribute("data-compromised"),
  ).toBeNull();
  await expect(frame.locator("body")).toHaveAttribute("data-blocked", "yes");
  await page.evaluate(() =>
    window.postMessage(
      { type: "traceback-prompt", text: "Untrusted bridge message" },
      "*",
    ),
  );
  await expect(
    page.getByText("Untrusted bridge message", { exact: true }),
  ).toHaveCount(0);
  await frame.getByRole("button", { name: "Review observation" }).click();
  await expect(
    page.getByRole("button", { name: "Send follow-up" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Send follow-up" }),
  ).toHaveCount(0);
});
