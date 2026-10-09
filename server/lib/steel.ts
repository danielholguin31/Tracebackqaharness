import { chromium, type Browser, type Page } from 'playwright';

export type SteelSession = { id: string; websocketUrl: string; sessionViewerUrl?: string };
let occupied = false;
export async function acquireBrowserSlot(check: () => Promise<void> = async () => {}) {
  const start=Date.now();
  while(occupied){await check();if(Date.now()-start>900000)throw new Error('Browser queue timeout');await new Promise(r=>setTimeout(r,200));}
  await check();
  // Check again after the asynchronous cancellation checkpoint to avoid competing claimants.
  if(occupied)return acquireBrowserSlot(check);
  occupied=true;return ()=>{occupied=false;};
}
export const steelBase = () => (process.env.STEEL_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
async function request(path: string, body?: object) {
  const response = await fetch(`${steelBase()}/v1${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.STEEL_API_KEY ? { 'steel-api-key': process.env.STEEL_API_KEY } : {}) },
    body: JSON.stringify(body || {}), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Steel returned ${response.status}. Check browser service configuration.`);
  return response.json();
}
export async function openBrowser(dimensions: { width: number; height: number }): Promise<{ session: SteelSession; browser: Browser; page: Page }> {
  const session: SteelSession = await request('/sessions', { dimensions, timeout: 900000 });
  try {
    const url = new URL(session.websocketUrl);
    url.searchParams.set('sessionId', session.id);
    if (process.env.STEEL_API_KEY) url.searchParams.set('apiKey', process.env.STEEL_API_KEY);
    const browser = await chromium.connectOverCDP(url.toString(), { timeout: 30000 });
    const context = browser.contexts()[0] || await browser.newContext({ viewport: dimensions });
    const page = context.pages()[0] || await context.newPage();
    await page.setViewportSize(dimensions);
    page.setDefaultTimeout(15000);
    return { session, browser, page };
  } catch (error) {
    await releaseBrowser(session.id).catch(() => {});
    throw error;
  }
}
export async function releaseBrowser(id: string) { await request(`/sessions/${encodeURIComponent(id)}/release`); }
