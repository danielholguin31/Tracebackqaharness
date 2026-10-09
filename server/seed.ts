import 'dotenv/config';
import { db, schema } from './db';
import { uid, now } from './lib/helpers';

const WS_ID = 'ws_demo';
const OWNER_ID = 'user_dh';

async function seed() {
  console.log('[seed] Seeding database...');

  // ─── Workspace ────────────────────────────────────────────
  await db.delete(schema.workspaces);
  await db.insert(schema.workspaces).values({
    id: WS_ID,
    name: 'Traceback Demo',
    slug: 'traceback-demo',
    planType: 'pro',
    creditsRemaining: 847,
    creditsTotal: 1000,
    createdAt: '2024-01-15T00:00:00.000Z',
  });

  // ─── Users ────────────────────────────────────────────────
  await db.delete(schema.users);
  await db.insert(schema.users).values([
    { id: OWNER_ID, workspaceId: WS_ID, email: 'diego@traceback.dev', name: 'Diego H.', initials: 'DH', color: 'from-indigo-500 to-purple-500', role: 'owner', createdAt: now() },
    { id: 'user_sk', workspaceId: WS_ID, email: 'sara@traceback.dev', name: 'Sara K.', initials: 'SK', color: 'from-emerald-500 to-teal-500', role: 'member', createdAt: now() },
    { id: 'user_mt', workspaceId: WS_ID, email: 'marcus@traceback.dev', name: 'Marcus T.', initials: 'MT', color: 'from-orange-400 to-red-500', role: 'member', createdAt: now() },
    { id: 'user_pn', workspaceId: WS_ID, email: 'priya@traceback.dev', name: 'Priya N.', initials: 'PN', color: 'from-pink-500 to-rose-500', role: 'admin', createdAt: now() },
  ]);

  // ─── Tests ────────────────────────────────────────────────
  await db.delete(schema.testSteps);
  await db.delete(schema.tests);

  const T1 = 'test_checkout_auto';
  const T2 = 'test_login_auto';
  const T3 = 'test_signup_auto';
  const T4 = 'test_search_auto';
  const T5 = 'test_dashboard_auto';
  const T6 = 'test_checkout_det';
  const T7 = 'test_profile_det';
  const T8 = 'test_onboarding_auto';

  await db.insert(schema.tests).values([
    {
      id: T1, workspaceId: WS_ID, name: 'Checkout — Payment Confirmation Regression', mode: 'autonomous',
      status: 'fail', environment: 'staging', entryPoint: 'https://staging.example.com/checkout',
      auth: 'test-user@example.com', runnerMode: 'standard',
      viewportJson: JSON.stringify({ mode: 'single', single: 'desktop' }),
      triggersJson: JSON.stringify({ onPr: true, onDeploy: false, scheduled: false }),
      suiteIdsJson: JSON.stringify(['suite_regression']),
      defaultReportsJson: JSON.stringify(['standard', 'regression']),
      tagsJson: JSON.stringify(['checkout', 'payments']),
      estimatedCredits: 12,
      createdAt: '2024-11-01T10:00:00.000Z',
      lastRunAt: '2024-12-15T09:30:00.000Z',
    },
    {
      id: T2, workspaceId: WS_ID, name: 'Login — SSO & Standard Auth', mode: 'autonomous',
      status: 'pass', environment: 'production', entryPoint: 'https://app.example.com/login',
      auth: 'test-sso@example.com', runnerMode: 'fast',
      viewportJson: JSON.stringify({ mode: 'single', single: 'desktop' }),
      triggersJson: JSON.stringify({ onPr: true, onDeploy: true, scheduled: false }),
      suiteIdsJson: JSON.stringify(['suite_smoke', 'suite_regression']),
      defaultReportsJson: JSON.stringify(['standard']),
      tagsJson: JSON.stringify(['auth', 'critical']),
      estimatedCredits: 6,
      createdAt: '2024-10-15T10:00:00.000Z',
      lastRunAt: '2024-12-15T10:00:00.000Z',
    },
    {
      id: T3, workspaceId: WS_ID, name: 'Sign-up — New User Onboarding Flow', mode: 'autonomous',
      status: 'pass', environment: 'staging', entryPoint: 'https://staging.example.com/signup',
      auth: '', runnerMode: 'standard',
      viewportJson: JSON.stringify({ mode: 'multi', multi: ['desktop', 'mobile'] }),
      triggersJson: JSON.stringify({ onPr: false, onDeploy: false, scheduled: true, cronExpression: '0 2 * * *' }),
      suiteIdsJson: JSON.stringify(['suite_smoke']),
      defaultReportsJson: JSON.stringify(['standard', 'accessibility']),
      tagsJson: JSON.stringify(['onboarding', 'signup']),
      estimatedCredits: 14,
      createdAt: '2024-11-05T10:00:00.000Z',
    },
    {
      id: T4, workspaceId: WS_ID, name: 'Product Search — Filter & Sort Accuracy', mode: 'autonomous',
      status: 'pass', environment: 'staging', entryPoint: 'https://staging.example.com/products',
      auth: 'test-user@example.com', runnerMode: 'standard',
      viewportJson: JSON.stringify({ mode: 'single', single: 'desktop' }),
      triggersJson: JSON.stringify({ onPr: false, onDeploy: false, scheduled: false }),
      suiteIdsJson: JSON.stringify([]),
      defaultReportsJson: JSON.stringify(['standard']),
      tagsJson: JSON.stringify(['search', 'catalog']),
      estimatedCredits: 8,
      createdAt: '2024-11-10T10:00:00.000Z',
    },
    {
      id: T5, workspaceId: WS_ID, name: 'Dashboard — Metrics & Widget Load', mode: 'autonomous',
      status: 'pass', environment: 'production', entryPoint: 'https://app.example.com/dashboard',
      auth: 'test-user@example.com', runnerMode: 'deep',
      viewportJson: JSON.stringify({ mode: 'single', single: 'desktop' }),
      triggersJson: JSON.stringify({ onPr: false, onDeploy: true, scheduled: false }),
      suiteIdsJson: JSON.stringify(['suite_smoke']),
      defaultReportsJson: JSON.stringify(['standard', 'performance']),
      tagsJson: JSON.stringify(['dashboard', 'performance']),
      estimatedCredits: 20,
      createdAt: '2024-11-20T10:00:00.000Z',
    },
    {
      id: T6, workspaceId: WS_ID, name: 'Checkout — Deterministic Step Verification', mode: 'deterministic',
      status: 'pass', environment: 'staging', entryPoint: 'https://staging.example.com/cart',
      auth: 'test-user@example.com', runnerMode: 'standard',
      viewportJson: JSON.stringify({ mode: 'single', single: 'desktop' }),
      triggersJson: JSON.stringify({ onPr: true, onDeploy: false, scheduled: false }),
      suiteIdsJson: JSON.stringify(['suite_regression']),
      defaultReportsJson: JSON.stringify(['standard']),
      tagsJson: JSON.stringify(['checkout', 'deterministic']),
      selfHealing: true, selfHealingSensitivity: 'medium',
      estimatedCredits: 5,
      createdAt: '2024-11-25T10:00:00.000Z',
    },
    {
      id: T7, workspaceId: WS_ID, name: 'User Profile — Edit & Save', mode: 'deterministic',
      status: 'never_run', environment: 'staging', entryPoint: 'https://staging.example.com/profile',
      auth: 'test-user@example.com', runnerMode: 'fast',
      viewportJson: JSON.stringify({ mode: 'single', single: 'desktop' }),
      triggersJson: JSON.stringify({ onPr: false, onDeploy: false, scheduled: false }),
      suiteIdsJson: JSON.stringify([]),
      defaultReportsJson: JSON.stringify(['standard']),
      tagsJson: JSON.stringify(['profile', 'settings']),
      selfHealing: false,
      estimatedCredits: 3,
      createdAt: '2024-12-01T10:00:00.000Z',
    },
    {
      id: T8, workspaceId: WS_ID, name: 'Admin Onboarding — Workspace Setup', mode: 'autonomous',
      status: 'pass', environment: 'staging', entryPoint: 'https://staging.example.com/onboarding',
      auth: 'admin@example.com', runnerMode: 'standard',
      viewportJson: JSON.stringify({ mode: 'single', single: 'desktop' }),
      triggersJson: JSON.stringify({ onPr: false, onDeploy: false, scheduled: false }),
      suiteIdsJson: JSON.stringify([]),
      defaultReportsJson: JSON.stringify(['standard']),
      tagsJson: JSON.stringify(['admin', 'onboarding']),
      estimatedCredits: 10,
      createdAt: '2024-12-05T10:00:00.000Z',
    },
  ]);

  // Test steps for deterministic test
  await db.insert(schema.testSteps).values([
    { id: uid(), testId: T6, order: 1, action: 'Navigate to cart page', isAiGenerated: true, generatedAction: 'goto /cart', type: 'navigate', target: 'https://staging.example.com/cart', value: '', css: false, stable: true, pressEnter: false, captureScreenshot: false },
    { id: uid(), testId: T6, order: 2, action: 'Click proceed to checkout', isAiGenerated: true, generatedAction: 'click proceed button', type: 'click', target: '[data-testid="proceed-checkout"]', value: '', css: true, stable: true, pressEnter: false, captureScreenshot: false },
    { id: uid(), testId: T6, order: 3, action: 'Fill card number', isAiGenerated: true, generatedAction: 'fill card input', type: 'fill', target: '[name="cardNumber"]', value: '4242424242424242', css: true, stable: true, pressEnter: false, captureScreenshot: false },
    { id: uid(), testId: T6, order: 4, action: 'Submit payment', isAiGenerated: true, generatedAction: 'click pay now', type: 'click', target: '[data-testid="pay-now"]', value: '', css: true, stable: true, pressEnter: false, captureScreenshot: true },
    { id: uid(), testId: T6, order: 5, action: 'Assert confirmation page', isAiGenerated: true, generatedAction: 'assert confirmation visible', type: 'assert', target: '.order-confirmation', value: 'Order confirmed', css: true, stable: true, pressEnter: false, captureScreenshot: true },
  ]);

  // ─── Runs ─────────────────────────────────────────────────
  await db.delete(schema.activityLogs);
  await db.delete(schema.reports);
  await db.delete(schema.runs);

  const R1 = 'run_001'; const R2 = 'run_002'; const R3 = 'run_003';
  const R4 = 'run_004'; const R5 = 'run_005'; const R6 = 'run_006';
  const R7 = 'run_007'; const R8 = 'run_008'; const R9 = 'run_009';
  const R10 = 'run_010'; const R11 = 'run_011'; const R12 = 'run_012';

  const runData = [
    { id: R1, testId: T2, testName: 'Login — SSO & Standard Auth', mode: 'autonomous', status: 'passed', environment: 'production', triggeredBy: 'pr', branch: 'feat/new-auth', commit: 'a1b2c3d', duration: 42.3, credits: 6, startedAt: '2024-12-15T10:00:00.000Z', completedAt: '2024-12-15T10:00:42.000Z', keyFinding: 'All assertions passed. No issues detected.', screenshotCount: 3, issueCount: 0 },
    { id: R2, testId: T1, testName: 'Checkout — Payment Confirmation Regression', mode: 'autonomous', status: 'failed', environment: 'staging', triggeredBy: 'pr', branch: 'feat/new-auth', commit: 'a1b2c3d', duration: 38.7, credits: 12, startedAt: '2024-12-15T09:30:00.000Z', completedAt: '2024-12-15T09:31:18.000Z', keyFinding: 'POST /api/billing returns 422 on valid card', screenshotCount: 2, issueCount: 1 },
    { id: R3, testId: T3, testName: 'Sign-up — New User Onboarding Flow', mode: 'autonomous', status: 'passed', environment: 'staging', triggeredBy: 'schedule', duration: 89.4, credits: 14, startedAt: '2024-12-15T02:00:00.000Z', completedAt: '2024-12-15T02:01:29.000Z', keyFinding: 'All assertions passed. No issues detected.', screenshotCount: 4, issueCount: 0 },
    { id: R4, testId: T5, testName: 'Dashboard — Metrics & Widget Load', mode: 'autonomous', status: 'passed', environment: 'production', triggeredBy: 'deploy', duration: 124.1, credits: 20, startedAt: '2024-12-14T16:30:00.000Z', completedAt: '2024-12-14T16:32:04.000Z', keyFinding: 'Performance metrics within acceptable range.', screenshotCount: 5, issueCount: 0 },
    { id: R5, testId: T6, testName: 'Checkout — Deterministic Step Verification', mode: 'deterministic', status: 'healed', environment: 'staging', triggeredBy: 'pr', branch: 'fix/cart-ui', commit: 'e5f6g7h', duration: 28.2, credits: 5, startedAt: '2024-12-14T14:00:00.000Z', completedAt: '2024-12-14T14:00:28.000Z', keyFinding: 'Step 3 selector self-healed. Original selector was stale.', screenshotCount: 2, issueCount: 0 },
    { id: R6, testId: T4, testName: 'Product Search — Filter & Sort Accuracy', mode: 'autonomous', status: 'passed', environment: 'staging', triggeredBy: 'manual', duration: 55.0, credits: 8, startedAt: '2024-12-14T11:00:00.000Z', completedAt: '2024-12-14T11:00:55.000Z', keyFinding: 'All assertions passed. No issues detected.', screenshotCount: 3, issueCount: 0 },
    { id: R7, testId: T2, testName: 'Login — SSO & Standard Auth', mode: 'autonomous', status: 'passed', environment: 'staging', triggeredBy: 'manual', duration: 39.1, credits: 6, startedAt: '2024-12-13T15:00:00.000Z', completedAt: '2024-12-13T15:00:39.000Z', keyFinding: 'All assertions passed.', screenshotCount: 2, issueCount: 0 },
    { id: R8, testId: T1, testName: 'Checkout — Payment Confirmation Regression', mode: 'autonomous', status: 'failed', environment: 'staging', triggeredBy: 'manual', duration: 41.5, credits: 12, startedAt: '2024-12-13T10:00:00.000Z', completedAt: '2024-12-13T10:00:41.000Z', keyFinding: 'POST /api/billing returns 422 on valid card', screenshotCount: 1, issueCount: 1 },
    { id: R9, testId: T8, testName: 'Admin Onboarding — Workspace Setup', mode: 'autonomous', status: 'passed', environment: 'staging', triggeredBy: 'manual', duration: 67.3, credits: 10, startedAt: '2024-12-12T09:00:00.000Z', completedAt: '2024-12-12T09:01:07.000Z', keyFinding: 'All assertions passed.', screenshotCount: 3, issueCount: 0 },
    { id: R10, testId: T3, testName: 'Sign-up — New User Onboarding Flow', mode: 'autonomous', status: 'passed', environment: 'staging', triggeredBy: 'schedule', duration: 92.0, credits: 14, startedAt: '2024-12-12T02:00:00.000Z', completedAt: '2024-12-12T02:01:32.000Z', keyFinding: 'All assertions passed.', screenshotCount: 4, issueCount: 0 },
    { id: R11, testId: T5, testName: 'Dashboard — Metrics & Widget Load', mode: 'autonomous', status: 'passed', environment: 'production', triggeredBy: 'deploy', duration: 118.5, credits: 20, startedAt: '2024-12-11T16:30:00.000Z', completedAt: '2024-12-11T16:32:18.000Z', keyFinding: 'Performance within threshold.', screenshotCount: 5, issueCount: 0 },
    { id: R12, testId: T4, testName: 'Product Search — Filter & Sort Accuracy', mode: 'autonomous', status: 'blocked', environment: 'staging', triggeredBy: 'manual', duration: 15.2, credits: 2, startedAt: '2024-12-11T11:00:00.000Z', completedAt: '2024-12-11T11:00:15.000Z', keyFinding: 'Staging environment unreachable. ERR_CONNECTION_REFUSED on entry point.', screenshotCount: 0, issueCount: 0 },
  ];

  await db.insert(schema.runs).values(runData.map(r => ({
    ...r,
    workspaceId: WS_ID,
    viewport: 'desktop',
    runnerMode: 'standard',
    triggeredByUser: OWNER_ID,
  })));

  // Activity logs for R2 (failed checkout run)
  await db.insert(schema.activityLogs).values([
    { id: uid(), runId: R2, step: 1, timestamp: '00:02.1', thought: 'Analyzing the test goal and planning execution strategy', action: 'await page.goto("https://staging.example.com/checkout")', isError: false },
    { id: uid(), runId: R2, step: 2, timestamp: '00:08.4', thought: 'Page loaded. Inspecting DOM structure and identifying key interactive elements', action: 'await page.waitForLoadState("networkidle")', isError: false, screenshotUrl: 'https://placeholder.co/1280x720' },
    { id: uid(), runId: R2, step: 3, timestamp: '00:14.2', thought: 'Located primary call-to-action. Beginning interaction flow', action: 'await page.locator("[data-testid=proceed-checkout]").click()', isError: false },
    { id: uid(), runId: R2, step: 4, timestamp: '00:19.7', thought: 'Filling required payment form fields with test credentials', action: 'await page.fill("[name=cardNumber]", "4242424242424242")', isError: false },
    { id: uid(), runId: R2, step: 5, timestamp: '00:25.1', thought: 'Submitting payment form and waiting for API response', action: 'await page.click("[data-testid=pay-now]")', isError: false },
    { id: uid(), runId: R2, step: 6, timestamp: '00:31.8', thought: 'Unexpected response received. POST /api/billing returned 422', action: 'const res = await page.waitForResponse("/api/billing")\n// Response: {"error":"payment_method_declined","code":422}', isError: false },
    { id: uid(), runId: R2, step: 7, timestamp: '00:36.4', thought: 'Page did not navigate to confirmation. Assertion failed', action: 'await expect(page.locator(".order-confirmation")).toBeVisible()\n// TimeoutError: locator not found after 5000ms', isError: true, screenshotUrl: 'https://placeholder.co/1280x720' },
  ]);

  // Activity logs for R1 (passed login run)
  await db.insert(schema.activityLogs).values([
    { id: uid(), runId: R1, step: 1, timestamp: '00:02.3', thought: 'Navigating to login page', action: 'await page.goto("https://app.example.com/login")', isError: false },
    { id: uid(), runId: R1, step: 2, timestamp: '00:09.1', thought: 'Page loaded. Locating login form elements', action: 'await page.waitForLoadState("networkidle")', isError: false, screenshotUrl: 'https://placeholder.co/1280x720' },
    { id: uid(), runId: R1, step: 3, timestamp: '00:15.6', thought: 'Filling email and password fields', action: 'await page.fill("[name=email]", "test-sso@example.com")', isError: false },
    { id: uid(), runId: R1, step: 4, timestamp: '00:22.4', thought: 'Submitting login form', action: 'await page.click("[type=submit]")', isError: false },
    { id: uid(), runId: R1, step: 5, timestamp: '00:29.0', thought: 'Verifying redirect to dashboard', action: 'await expect(page).toHaveURL("/dashboard")', isError: false },
    { id: uid(), runId: R1, step: 6, timestamp: '00:35.5', thought: 'All assertions passed', action: '// Run completed successfully', isError: false, screenshotUrl: 'https://placeholder.co/1280x720' },
  ]);

  // Reports
  await db.insert(schema.reports).values([
    { id: uid(), runId: R1, type: 'standard', format: 'ui', status: 'generated', generatedAt: '2024-12-15T10:01:00.000Z' },
    { id: uid(), runId: R2, type: 'standard', format: 'ui', status: 'generated', generatedAt: '2024-12-15T09:32:00.000Z' },
    { id: uid(), runId: R2, type: 'regression', format: 'ui', status: 'generated', generatedAt: '2024-12-15T09:32:30.000Z' },
    { id: uid(), runId: R3, type: 'standard', format: 'ui', status: 'generated', generatedAt: '2024-12-15T02:02:00.000Z' },
    { id: uid(), runId: R3, type: 'accessibility', format: 'pdf', status: 'generated', generatedAt: '2024-12-15T02:03:00.000Z' },
    { id: uid(), runId: R4, type: 'standard', format: 'ui', status: 'generated', generatedAt: '2024-12-14T16:33:00.000Z' },
    { id: uid(), runId: R4, type: 'performance', format: 'pdf', status: 'generated', generatedAt: '2024-12-14T16:34:00.000Z' },
  ]);

  // ─── Issues ───────────────────────────────────────────────
  await db.delete(schema.issues);
  await db.insert(schema.issues).values([
    { id: 'TR-1042', workspaceId: WS_ID, runId: R2, testId: T1, title: 'POST /api/billing returns 422 on valid card', severity: 'critical', status: 'open', flow: 'Checkout — Payment Confirmation Regression', context: 'staging / desktop', evidence: 'Response body: {"error":"payment_method_declined","code":422}. Occurred consistently on staging with test card 4242-4242-4242-4242.', proposedSolution: 'Check billing service for Stripe webhook misconfiguration. The test card may not be whitelisted in the staging environment.', agentNote: 'Issue auto-detected during test execution. Evidence captured in activity log.', screenshotsJson: JSON.stringify(['https://placeholder.co/1280x720']), triggeredBy: 'pr', createdAt: '2024-12-15T09:31:18.000Z' },
    { id: 'TR-1041', workspaceId: WS_ID, runId: R8, testId: T1, title: 'POST /api/billing returns 422 on valid card', severity: 'critical', status: 'open', flow: 'Checkout — Payment Confirmation Regression', context: 'staging / desktop', evidence: 'Reproduced manually. Same error as TR-1042.', proposedSolution: 'See TR-1042 for fix details.', screenshotsJson: JSON.stringify([]), triggeredBy: 'manual', createdAt: '2024-12-13T10:00:41.000Z' },
    { id: 'TR-1040', workspaceId: WS_ID, runId: R12, testId: T4, title: 'Staging environment unreachable during scheduled run', severity: 'warning', status: 'resolved', flow: 'Product Search — Filter & Sort Accuracy', context: 'staging / desktop', evidence: 'ERR_CONNECTION_REFUSED connecting to staging.example.com. Environment was down for ~15 min during maintenance window.', proposedSolution: 'Schedule runs outside maintenance window. Add environment health check before run start.', screenshotsJson: JSON.stringify([]), triggeredBy: 'manual', resolvedAt: '2024-12-12T12:00:00.000Z', createdAt: '2024-12-11T11:00:15.000Z' },
    { id: 'TR-1039', workspaceId: WS_ID, runId: R5, testId: T6, title: 'Checkout step 3 selector became stale after deploy', severity: 'warning', status: 'resolved', flow: 'Checkout — Deterministic Step Verification', context: 'staging / desktop', evidence: 'Selector [data-testid="fill-card"] was renamed to [name="cardNumber"] in the last deploy. Self-healing resolved automatically.', proposedSolution: 'Update test step selector to match current DOM. Test passed via self-heal but selector should be updated.', screenshotsJson: JSON.stringify([]), triggeredBy: 'pr', resolvedAt: '2024-12-14T14:01:00.000Z', createdAt: '2024-12-14T14:00:28.000Z' },
    { id: 'TR-1038', workspaceId: WS_ID, runId: R4, testId: T5, title: 'Dashboard widget "Credits Used" renders with stale data on reload', severity: 'high', status: 'pushed', flow: 'Dashboard — Metrics & Widget Load', context: 'production / desktop', evidence: 'React Query cache not invalidated after run completion. Credits counter shows previous value until manual refresh.', proposedSolution: 'Invalidate ["overview"] query key on receipt of run_complete event.', agentNote: 'Pushed to GitHub as issue #204 on main repo.', screenshotsJson: JSON.stringify([]), triggeredBy: 'deploy', pushedAt: '2024-12-14T17:00:00.000Z', externalRefJson: JSON.stringify({ type: 'github', url: 'https://github.com/example/app/issues/204', id: '204' }), createdAt: '2024-12-14T16:32:04.000Z' },
    { id: 'TR-1037', workspaceId: WS_ID, runId: R3, testId: T3, title: 'Password strength indicator missing on mobile viewport', severity: 'warning', status: 'open', flow: 'Sign-up — New User Onboarding Flow', context: 'staging / mobile', evidence: 'Component PasswordStrengthMeter is conditionally hidden on screens < 400px. Failing CSS media query.', proposedSolution: 'Remove display:none from PasswordStrengthMeter on mobile. Replace with compact variant.', screenshotsJson: JSON.stringify(['https://placeholder.co/390x844']), triggeredBy: 'schedule', createdAt: '2024-12-15T02:01:29.000Z' },
    { id: 'TR-1036', workspaceId: WS_ID, runId: R7, testId: T2, title: 'SSO redirect appends duplicate state parameter', severity: 'info', status: 'dismissed', flow: 'Login — SSO & Standard Auth', context: 'staging / desktop', evidence: 'OAuth redirect URL contains state=xxx&state=yyy. Second state param is ignored by provider but indicates an issue in URL builder.', screenshotsJson: JSON.stringify([]), triggeredBy: 'manual', dismissReason: 'wont_fix', createdAt: '2024-12-13T15:00:39.000Z' },
    { id: 'TR-1035', workspaceId: WS_ID, runId: R9, testId: T8, title: 'Onboarding step 2 tooltip not accessible via keyboard', severity: 'warning', status: 'open', flow: 'Admin Onboarding — Workspace Setup', context: 'staging / desktop', evidence: 'Tooltip trigger lacks tabindex and aria-describedby. Keyboard users cannot access step 2 hint text.', proposedSolution: 'Add tabindex=0, role="button", aria-describedby to tooltip trigger element.', screenshotsJson: JSON.stringify([]), triggeredBy: 'manual', createdAt: '2024-12-12T09:01:07.000Z' },
    { id: 'TR-1034', workspaceId: WS_ID, runId: R6, testId: T4, title: 'Search results flicker on rapid filter change', severity: 'high', status: 'open', flow: 'Product Search — Filter & Sort Accuracy', context: 'staging / desktop', evidence: 'When switching filter options faster than 300ms, the results list briefly empties before repopulating. Caused by concurrent React Query fetches resolving out of order. Reproducible on low-bandwidth connections.', proposedSolution: 'Debounce filter state updates by 250ms or use React Query\'s keepPreviousData option to prevent empty-state flash.', screenshotsJson: JSON.stringify([]), triggeredBy: 'manual', createdAt: '2024-12-14T11:00:55.000Z' },
    { id: 'TR-1033', workspaceId: WS_ID, runId: R10, testId: T7, title: 'Profile avatar upload silently fails on files > 2MB', severity: 'high', status: 'open', flow: 'User Profile — Settings & Avatar', context: 'production / desktop', evidence: 'POST /api/users/avatar returns 413 with no user-facing error message. Upload spinner continues indefinitely. Confirmed with 3.4MB JPEG. Files under 2MB upload correctly.', proposedSolution: 'Add client-side file size validation before upload. Surface the 413 response as a toast error: "File too large — maximum size is 2MB."', agentNote: 'Issue auto-detected during test execution.', screenshotsJson: JSON.stringify([]), triggeredBy: 'schedule', createdAt: '2024-12-11T08:45:00.000Z' },
    { id: 'TR-1032', workspaceId: WS_ID, runId: R11, testId: T3, title: 'Email verification link expires in 10 min instead of 24h', severity: 'critical', status: 'open', flow: 'Sign-up — New User Onboarding Flow', context: 'production / desktop', evidence: 'Token TTL set to 600s in auth config (env: TOKEN_EXPIRY). Should be 86400s per product spec. Users who don\'t verify immediately are locked out and must request a new link.', proposedSolution: 'Update TOKEN_EXPIRY env var to 86400 in production. Audit staging config for the same issue.', screenshotsJson: JSON.stringify([]), triggeredBy: 'schedule', createdAt: '2024-12-10T14:22:00.000Z' },
  ]);

  // ─── Suites ───────────────────────────────────────────────
  await db.delete(schema.suiteRunResults);
  await db.delete(schema.suiteRuns);
  await db.delete(schema.suites);

  const S1 = 'suite_smoke'; const S2 = 'suite_regression'; const S3 = 'suite_nightly';

  await db.insert(schema.suites).values([
    { id: S1, workspaceId: WS_ID, name: 'Smoke Tests', testIdsJson: JSON.stringify([T2, T5, T3]), triggersJson: JSON.stringify({ onPr: true, onDeploy: true, scheduled: false }), parallel: true, maxConcurrency: 3, retryFailedTests: 'once', status: 'passing', lastRunAt: '2024-12-15T10:05:00.000Z', createdAt: '2024-10-01T00:00:00.000Z' },
    { id: S2, workspaceId: WS_ID, name: 'Regression Suite', testIdsJson: JSON.stringify([T1, T2, T6, T4]), triggersJson: JSON.stringify({ onPr: true, onDeploy: false, scheduled: false }), parallel: false, retryFailedTests: 'none', status: 'failing', lastRunAt: '2024-12-15T09:35:00.000Z', createdAt: '2024-10-15T00:00:00.000Z' },
    { id: S3, workspaceId: WS_ID, name: 'Nightly Full Suite', testIdsJson: JSON.stringify([T1, T2, T3, T4, T5, T8]), triggersJson: JSON.stringify({ onPr: false, onDeploy: false, scheduled: true, cronExpression: '0 3 * * *' }), parallel: true, maxConcurrency: 4, retryFailedTests: 'once', status: 'passing', lastRunAt: '2024-12-15T03:00:00.000Z', createdAt: '2024-11-01T00:00:00.000Z' },
  ]);

  const SR1 = 'srun_001'; const SR2 = 'srun_002';
  await db.insert(schema.suiteRuns).values([
    { id: SR1, suiteId: S2, status: 'failed', startedAt: '2024-12-15T09:30:00.000Z', completedAt: '2024-12-15T09:45:00.000Z', triggeredBy: 'pr' },
    { id: SR2, suiteId: S1, status: 'passed', startedAt: '2024-12-15T10:00:00.000Z', completedAt: '2024-12-15T10:05:00.000Z', triggeredBy: 'pr' },
  ]);
  await db.insert(schema.suiteRunResults).values([
    { id: uid(), suiteRunId: SR1, testId: T1, testName: 'Checkout — Payment Confirmation Regression', runId: R2, status: 'failed', duration: 38.7, issueCount: 1 },
    { id: uid(), suiteRunId: SR1, testId: T2, testName: 'Login — SSO & Standard Auth', runId: R1, status: 'passed', duration: 42.3, issueCount: 0 },
    { id: uid(), suiteRunId: SR1, testId: T6, testName: 'Checkout — Deterministic Step Verification', runId: R5, status: 'healed', duration: 28.2, issueCount: 0 },
    { id: uid(), suiteRunId: SR2, testId: T2, testName: 'Login — SSO & Standard Auth', runId: R1, status: 'passed', duration: 42.3, issueCount: 0 },
    { id: uid(), suiteRunId: SR2, testId: T5, testName: 'Dashboard — Metrics & Widget Load', runId: R4, status: 'passed', duration: 124.1, issueCount: 0 },
    { id: uid(), suiteRunId: SR2, testId: T3, testName: 'Sign-up — New User Onboarding Flow', runId: R3, status: 'passed', duration: 89.4, issueCount: 0 },
  ]);

  // ─── Events ───────────────────────────────────────────────
  await db.delete(schema.events);
  await db.insert(schema.events).values([
    { id: 'ev_1042', workspaceId: WS_ID, type: 'pr', summary: 'PR #102 — feat: new auth middleware', prNumber: '#102', branch: 'feat/new-auth', prUrl: 'https://github.com/example/app/pull/102', initiatedAt: '2024-12-15T09:28:00.000Z', completedAt: '2024-12-15T09:45:00.000Z', duration: 1020, status: 'fail', resultJson: JSON.stringify({ passed: 2, failed: 1 }), testIdsJson: JSON.stringify([T1, T2, T6]), runIdsJson: JSON.stringify([R2, R1, R5]), issueIdsJson: JSON.stringify(['TR-1042']) },
    { id: 'ev_1041', workspaceId: WS_ID, type: 'pr', summary: 'PR #99 — fix: cart UI layout fix', prNumber: '#99', branch: 'fix/cart-ui', prUrl: 'https://github.com/example/app/pull/99', initiatedAt: '2024-12-14T13:55:00.000Z', completedAt: '2024-12-14T14:05:00.000Z', duration: 600, status: 'pass', resultJson: JSON.stringify({ passed: 2, failed: 0 }), testIdsJson: JSON.stringify([T6, T2]), runIdsJson: JSON.stringify([R5, R7]), issueIdsJson: JSON.stringify([]) },
    { id: 'ev_1040', workspaceId: WS_ID, type: 'mcp', summary: 'MCP tool call: run_regression_suite', initiatedAt: '2024-12-13T11:00:00.000Z', completedAt: '2024-12-13T11:15:00.000Z', duration: 900, status: 'fail', resultJson: JSON.stringify({ passed: 3, failed: 1 }), testIdsJson: JSON.stringify([T1, T2, T6, T4]), runIdsJson: JSON.stringify([R8, R7]), issueIdsJson: JSON.stringify(['TR-1041']), rawPayloadJson: JSON.stringify({ tool: 'run_regression_suite', params: { env: 'staging' } }), agentResponse: 'Regression suite completed. 3 passed, 1 failed. Issue TR-1041 created for checkout payment failure.' },
    { id: 'ev_1039', workspaceId: WS_ID, type: 'mcp', summary: 'MCP tool call: run_smoke_tests', initiatedAt: '2024-12-12T10:00:00.000Z', completedAt: '2024-12-12T10:08:00.000Z', duration: 480, status: 'pass', resultJson: JSON.stringify({ passed: 3, failed: 0 }), testIdsJson: JSON.stringify([T2, T5, T3]), runIdsJson: JSON.stringify([R7, R9]), issueIdsJson: JSON.stringify([]), rawPayloadJson: JSON.stringify({ tool: 'run_smoke_tests', params: {} }), agentResponse: 'Smoke tests passed. All 3 tests completed successfully in staging.' },
  ]);

  // ─── Operator ─────────────────────────────────────────────
  await db.delete(schema.operatorMessages);
  await db.delete(schema.operatorSessions);
  await db.delete(schema.operatorSettings);

  const SESSION_ID = 'session_001';
  await db.insert(schema.operatorSessions).values({
    id: SESSION_ID,
    workspaceId: WS_ID,
    title: 'Checkout flow failure — Dec 15',
    participantsJson: JSON.stringify(['user_dh']),
    createdAt: '2024-12-15T09:40:00.000Z',
    updatedAt: '2024-12-15T09:45:00.000Z',
  });

  await db.insert(schema.operatorMessages).values([
    {
      id: uid(), sessionId: SESSION_ID, role: 'user', content: 'The checkout run failed again. Can you tell me what happened?',
      fromUserId: OWNER_ID, createdAt: '2024-12-15T09:40:00.000Z',
    },
    {
      id: uid(), sessionId: SESSION_ID, role: 'operator',
      content: "I looked into run **R2** for *Checkout — Payment Confirmation Regression*.\n\nAt step 6, POST /api/billing returned **422** with `{\"error\":\"payment_method_declined\"}`. The confirmation page was never reached.\n\nThis matches the previous failure from Dec 13. The test card `4242-4242-4242-4242` appears to be hitting a Stripe webhook misconfiguration on staging.",
      componentsJson: JSON.stringify([{
        type: 'run_summary',
        data: { runId: R2, flow: 'Checkout — Payment Confirmation Regression', result: 'Failed', finding: 'POST /api/billing returns 422 on valid card', time: '2024-12-15T09:31:18.000Z', env: 'staging', href: `/runs/${R2}` }
      }]),
      createdAt: '2024-12-15T09:40:15.000Z',
    },
    {
      id: uid(), sessionId: SESSION_ID, role: 'user', content: 'Can you create a targeted test just for the billing API call?',
      fromUserId: OWNER_ID, createdAt: '2024-12-15T09:42:00.000Z',
    },
    {
      id: uid(), sessionId: SESSION_ID, role: 'operator',
      content: "Sure — here's a draft test focused specifically on verifying the POST /api/billing endpoint returns 200 with a valid test card.",
      componentsJson: JSON.stringify([{
        type: 'test_draft',
        data: { name: 'Billing API — Valid Card 200 Response', project: 'Traceback (Production)', environment: 'Staging', entryPoint: 'https://staging.example.com/checkout', auth: 'test-user@example.com', goal: 'Verify POST /api/billing completes successfully and returns 200 with a valid Stripe test card (4242-4242-4242-4242)', style: 'Autonomous', expectedOutcome: 'POST /api/billing responds with 200 and order confirmation page renders with order ID' }
      }]),
      createdAt: '2024-12-15T09:42:30.000Z',
    },
  ]);

  await db.insert(schema.operatorSettings).values({
    id: uid(),
    workspaceId: WS_ID,
    autonomyPreset: 'balanced',
    responseFormat: 50,
    mockupFreq: 50,
    responseLength: 50,
    model: 'gpt-4o-mini',
    instructions: '',
    alwaysDo: '',
    neverDo: '',
  });

  // ─── Toolbox ──────────────────────────────────────────────
  await db.delete(schema.toolboxBrowser);
  await db.delete(schema.integrations);
  await db.insert(schema.toolboxBrowser).values({
    id: uid(), workspaceId: WS_ID, headless: true, slowMo: 0, timeout: 30000, screenshots: 'on-failure',
  });
  await db.insert(schema.integrations).values({
    id: uid(), workspaceId: WS_ID,
    githubJson: JSON.stringify({ installed: true, repos: ['example/app', 'example/api'] }),
    linearJson: JSON.stringify({ installed: false }),
    jiraJson: JSON.stringify({ installed: false }),
    slackJson: JSON.stringify({ installed: false }),
  });

  // ─── Personal Projects ────────────────────────────────────
  await db.delete(schema.personalProjects);
  await db.insert(schema.personalProjects).values([
    { id: 'proj-1', ownerId: OWNER_ID, workspaceId: WS_ID, name: 'my-saas', baseUrl: 'app.mysaas.com', color: '#7B8FC2', pinned: false, createdAt: '2025-01-15T00:00:00.000Z', lastActiveAt: '2025-03-28T00:00:00.000Z' },
    { id: 'proj-2', ownerId: OWNER_ID, workspaceId: WS_ID, name: 'dev-portfolio', baseUrl: 'diegoh.dev', color: '#7BA87E', pinned: true, createdAt: '2025-02-01T00:00:00.000Z', lastActiveAt: '2025-03-25T00:00:00.000Z' },
    { id: 'proj-3', ownerId: OWNER_ID, workspaceId: WS_ID, name: 'side-project-api', baseUrl: 'api.sideproject.io', color: '#C27B6E', pinned: false, createdAt: '2025-03-01T00:00:00.000Z', lastActiveAt: '2025-03-20T00:00:00.000Z' },
  ]);

  console.log('[seed] Done! Database seeded successfully.');
}

seed().catch(err => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
