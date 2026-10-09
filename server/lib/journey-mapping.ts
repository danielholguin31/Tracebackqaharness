import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { tracebackStore, StoreError } from "./traceback-store";
import { acquireBrowserSlot, openBrowser, releaseBrowser } from "./steel";
import { uid, now } from "./helpers";
import { mappingSchema } from "./journey-mapping-schema";

export { mappingSchema } from "./journey-mapping-schema";
export async function discoverSourceRoutes() {
  const root = path.resolve(process.env.TRACEBACK_REPO_ROOT || ".");
  const routes = new Map<
    string,
    { path: string; source: string; observed: boolean }
  >();
  let inspected = 0;
  async function walk(directory: string) {
    for (const e of await fs.readdir(directory, { withFileTypes: true })) {
      if (inspected >= 3000) return;
      if (
        e.isSymbolicLink() ||
        [
          "node_modules",
          ".git",
          ".traceback",
          "dist",
          "data",
          "test-results",
          "vendor",
        ].includes(e.name)
      )
        continue;
      const file = path.join(directory, e.name);
      if (e.isDirectory()) await walk(file);
      else if (/\.(tsx?|jsx?)$/.test(e.name)) {
        inspected++;
        if ((await fs.stat(file)).size > 300000) continue;
        const source = path.relative(root, file);
        const text = await fs.readFile(file, "utf8");
        for (const match of text.matchAll(
          /(?:<Route\b[^>]*\bpath\s*=\s*["']|path\s*:\s*["'])(\/[^"']*)["']/g,
        ))
          if (routes.size < 2000)
            routes.set(match[1], { path: match[1], source, observed: false });
        if (
          /(?:^|\/)app\/.*\/page\.[jt]sx?$/.test(source) ||
          /^app\/page\.[jt]sx?$/.test(source)
        ) {
          const route =
            "/" +
            source
              .replace(/^.*?app\//, "")
              .replace(/\/?page\.[jt]sx?$/, "")
              .split("/")
              .filter((x) => x && !/^\(.*\)$/.test(x))
              .join("/");
          routes.set(route, { path: route, source, observed: false });
        }
      }
    }
  }
  await walk(root);
  return {
    routes: [...routes.values()].sort((a, b) => a.path.localeCompare(b.path)),
    filesInspected: inspected,
    truncated: inspected >= 3000,
  };
}
export async function startMapping(input: unknown) {
  const options = mappingSchema.parse(input);
  const id = uid();
  await tracebackStore.write(`evidence/maps/${id}.json`, {
    id,
    status: "queued",
    options,
    createdAt: now(),
    pages: [],
    error: null,
  });
  void mapBrowser(id, options).catch(console.error);
  return { id, status: "queued" };
}
export async function mapBrowser(
  id: string,
  options: z.infer<typeof mappingSchema>,
) {
  let connection: Awaited<ReturnType<typeof openBrowser>> | undefined;
  let releaseSlot: (() => void) | undefined;
  const pages: any[] = [];
  const visited = new Set<string>();
  const queue = [options.entryPoint];
  const origin = new URL(options.entryPoint).origin;
  const check = async () => {
    try {
      await tracebackStore.read(`evidence/maps/${id}.cancelled.json`);
      throw new StoreError("Mapping cancelled", 409);
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
    const job = await tracebackStore.read(`evidence/maps/${id}.json`);
    if (job.status === "cancelled")
      throw new StoreError("Mapping cancelled", 409);
  };
  try {
    releaseSlot = await acquireBrowserSlot(check);
    await check();
    connection = await openBrowser({ width: 1440, height: 900 });
    await connection.page.route("**/*", async (route) => {
      if (
        route.request().isNavigationRequest() &&
        route.request().frame() === connection!.page.mainFrame() &&
        new URL(route.request().url()).origin !== origin
      ) {
        await route.abort();
        return;
      }
      await route.continue();
    });
    while (queue.length && pages.length < options.maxPages) {
      await check();
      const target = queue.shift()!;
      if (visited.has(target)) continue;
      visited.add(target);
      await tracebackStore.write(`evidence/maps/${id}.json`, {
        id,
        status: "running",
        options,
        createdAt: now(),
        pages,
      });
      try {
        const response = await connection.page.goto(target, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        const observed = await connection.page.evaluate(() => {
          const links = [...document.querySelectorAll("a[href]")].map((a) => ({
            href: (a as HTMLAnchorElement).href,
            label:
              a.textContent?.trim().slice(0, 120) ||
              a.getAttribute("aria-label") ||
              "",
          }));
          const controls = [
            ...document.querySelectorAll(
              "button,input,select,textarea,[role=button]",
            ),
          ]
            .map((e) => {
              const rect = e.getBoundingClientRect();
              const input = e as HTMLInputElement;
              const labels = input.labels
                ? [...input.labels].map((x) => x.textContent).join(" ")
                : "";
              return {
                tag: e.tagName,
                name: (
                  e.getAttribute("aria-label") ||
                  labels ||
                  e.textContent ||
                  e.getAttribute("title") ||
                  ""
                )
                  .trim()
                  .slice(0, 120),
                type: e.getAttribute("type"),
                id: e.id,
                visible: rect.width > 0 && rect.height > 0,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              };
            })
            .filter((c) => c.visible);
          return {
            title: document.title,
            heading: document.querySelector("h1")?.textContent?.trim() || "",
            links: links.slice(0, 200),
            controls: controls.slice(0, 200),
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        const artifact = `map-${id}-${pages.length}.png`;
        await fs.mkdir("data/artifacts", { recursive: true });
        await fs.writeFile(
          path.resolve("data/artifacts", artifact),
          await connection.page.screenshot(),
        );
        pages.push({
          url: target,
          status: response?.status() || 200,
          ...observed,
          screenshotUrl: `/api/artifacts/${artifact}`,
          observedAt: now(),
          findings: [
            ...observed.controls
              .filter(
                (c) =>
                  !c.name &&
                  !["hidden", "submit", "reset"].includes(c.type || ""),
              )
              .map((c) => ({
                kind: "unnamed-control",
                message: `${c.tag.toLowerCase()}${c.id ? " #" + c.id : ""} has no observed accessible label. Verify aria-labelledby before treating it as a defect.`,
              })),
            ...(observed.overflow
              ? [
                  {
                    kind: "horizontal-overflow",
                    message: "Content exceeds the observed desktop viewport.",
                  },
                ]
              : []),
          ],
        });
        for (const link of observed.links) {
          try {
            const u = new URL(link.href);
            u.hash = "";
            if (
              u.origin === origin &&
              !u.search &&
              !/\.(pdf|zip|png|jpe?g|svg)$/i.test(u.pathname) &&
              !visited.has(u.href) &&
              !queue.includes(u.href) &&
              queue.length < 200
            )
              queue.push(u.href);
          } catch {}
        }
      } catch (e) {
        pages.push({
          url: target,
          error: e instanceof Error ? e.message : "Page could not be observed",
          observedAt: now(),
        });
      }
    }
    await check();
    await tracebackStore.write(`evidence/maps/${id}.json`, {
      id,
      status: "completed",
      options,
      pages,
      completedAt: now(),
      remainingUrls: queue,
      truncated: queue.length > 0,
    });
  } catch (e) {
    const prior = await tracebackStore.read(`evidence/maps/${id}.json`);
    await tracebackStore.write(`evidence/maps/${id}.json`, {
      ...prior,
      status:
        e instanceof Error && e.message === "Mapping cancelled"
          ? "cancelled"
          : "blocked",
      pages,
      error: e instanceof Error ? e.message : "Mapping failed",
    });
  } finally {
    if (connection) {
      await connection.browser.close().catch(() => {});
      await releaseBrowser(connection.session.id).catch(() => {});
    }
    releaseSlot?.();
  }
}
export async function importMapping(id: string) {
  const job = await tracebackStore.read(`evidence/maps/${id}.json`);
  if (job.status !== "completed")
    throw new StoreError("Only completed mappings can be imported", 409);
  const ontology = await tracebackStore.ontology();
  const additions = job.pages
    .filter((p: any) => !p.error)
    .map((p: any) => ({
      path: new URL(p.url).pathname,
      source: `map:${id}`,
      observed: true,
    }));
  ontology.routes = [
    ...new Map(
      [...ontology.routes, ...additions].map((r) => [r.path, r]),
    ).values(),
  ];
  await tracebackStore.saveOntology(ontology);
  const created = [];
  for (const page of job.pages.filter((p: any) => !p.error && p.status < 400)) {
    const hostname = new URL(page.url).host
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase();
    const slug = (
      `route-${hostname}-` +
      new URL(page.url).pathname
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()
    ).slice(0, 79);
    try {
      await tracebackStore.get(slug);
      continue;
    } catch (e: any) {
      if (e.status !== 404) throw e;
    }
    created.push(
      await tracebackStore.save({
        id: slug,
        name: page.heading || page.title || new URL(page.url).pathname,
        entryPoint: page.url,
        expectedOutcome: "The page loads and its main content is visible.",
        routes: [new URL(page.url).pathname],
        status: "draft",
        steps: [
          {
            order: 0,
            type: "assert",
            target: "body",
            value: "",
            css: true,
            action: "Verify the observed page has visible content",
          },
        ],
        provenance: { kind: "observed-link", evidence: `map:${id}` },
      }),
    );
  }
  return {
    created,
    notice:
      "These drafts check page reachability. Review and add meaningful outcomes before treating them as complete user journeys.",
  };
}
export async function recoverMappings() {
  let files: string[];
  try {
    files = await fs.readdir(await tracebackStore.file("evidence/maps"));
  } catch (e: any) {
    if (e.code === "ENOENT") return;
    throw e;
  }
  for (const file of files.filter(
    (f) => f.endsWith(".json") && !f.endsWith(".cancelled.json"),
  )) {
    const job = await tracebackStore.read(`evidence/maps/${file}`);
    if (["queued", "running"].includes(job.status))
      await tracebackStore.write(`evidence/maps/${file}`, {
        ...job,
        status: "blocked",
        error: "Server restarted during mapping. Start a new map.",
      });
  }
}
