import { tracebackStore, StoreError } from "./traceback-store";
import { uid, now } from "./helpers";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

async function github(endpoint: string, method = "GET", body?: unknown) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!process.env.GITHUB_TOKEN || !repo)
    throw new StoreError(
      "Configure GITHUB_TOKEN and GITHUB_REPOSITORY for repository integration",
      503,
    );
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo))
    throw new StoreError("Invalid repository configuration", 503);
  const r = await fetch(`https://api.github.com/repos/${repo}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new StoreError(`GitHub request failed (${r.status})`, 502);
  return r.json();
}
export async function syncCanonicalToGithub() {
  const repo = await github("");
  const branch = repo.default_branch;
  const head = await github(`/git/ref/heads/${encodeURIComponent(branch)}`);
  const commit = await github(`/git/commits/${head.object.sha}`);
  const journeys = await tracebackStore.list();
  const files = [
    {
      path: ".traceback/ontology.json",
      content: JSON.stringify(await tracebackStore.ontology(), null, 2) + "\n",
    },
    ...journeys.map((j) => ({
      path: `.traceback/journeys/${j.id}/journey.json`,
      content: JSON.stringify(j, null, 2) + "\n",
    })),
  ];
  if (files.length > 200)
    throw new StoreError("Split exports larger than 200 canonical files", 400);
  const tree = [];
  for (const file of files) {
    const blob = await github("/git/blobs", "POST", {
      content: file.content,
      encoding: "utf-8",
    });
    tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const createdTree = await github("/git/trees", "POST", {
    base_tree: commit.tree.sha,
    tree,
  });
  if (createdTree.sha === commit.tree.sha)
    return { unchanged: true, repository: repo.full_name };
  const createdCommit = await github("/git/commits", "POST", {
    message: "Update canonical Traceback journeys and ontology",
    tree: createdTree.sha,
    parents: [head.object.sha],
  });
  const ref = `traceback/journeys-${uid().slice(0, 8)}`;
  await github("/git/refs", "POST", {
    ref: `refs/heads/${ref}`,
    sha: createdCommit.sha,
  });
  const pr = await github("/pulls", "POST", {
    title: "Update Traceback journey definitions",
    head: ref,
    base: branch,
    body: "Updates canonical `.traceback` journey definitions and ontology. Runtime screenshots, secrets, and synthetic evidence are excluded. Review journey outcomes before merging.",
  });
  return {
    repository: repo.full_name,
    branch: ref,
    url: pr.html_url,
    number: pr.number,
  };
}
export async function githubRepositoryStatus() {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY)
    return { configured: false, repository: null };
  const repo = await github("");
  return {
    configured: true,
    repository: repo.full_name,
    url: repo.html_url,
    defaultBranch: repo.default_branch,
  };
}
export async function discoverGithubRoutes() {
  const repo = await github("");
  const tree = await github(
    `/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`,
  );
  const candidates = tree.tree.filter(
    (f: any) =>
      f.type === "blob" &&
      /\.[jt]sx?$/.test(f.path) &&
      /(?:app\/.*page\.[jt]sx?$|(?:App|Router|Routes|routes|router)\.[jt]sx?$)/.test(
        f.path,
      ) &&
      f.size < 300000,
  );
  const routes = new Map<string, any>();
  for (const file of candidates.slice(0, 50)) {
    const blob = await github("/git/blobs/" + file.sha);
    const source = `github:${repo.full_name}@${repo.default_branch}:${file.path}`;
    const text = Buffer.from(blob.content, "base64").toString("utf8");
    for (const match of text.matchAll(
      /(?:<Route\b[^>]*\bpath\s*=\s*["']|path\s*:\s*["'])(\/[^"']*)["']/g,
    ))
      routes.set(match[1], { path: match[1], source, observed: false });
    if (/(?:^|\/)app\/(?:.*\/)?page\.[jt]sx?$/.test(file.path)) {
      const route =
        "/" +
        file.path
          .replace(/^.*?app\//, "")
          .replace(/\/?page\.[jt]sx?$/, "")
          .split("/")
          .filter((s: string) => s && !/^\(.*\)$/.test(s))
          .join("/");
      routes.set(route, { path: route, source, observed: false });
    }
  }
  return {
    repository: repo.full_name,
    routes: [...routes.values()],
    filesInspected: Math.min(50, candidates.length),
    truncated: !!tree.truncated || candidates.length > 50,
    notice:
      "Static route candidates from the configured GitHub repository. Dynamic configuration and business workflows still require review.",
  };
}
export async function prepareAutofix(runId: string) {
  const [run] = await db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.id, runId));
  if (!run) throw new StoreError("Run not found", 404);
  if (run.status !== "failed")
    throw new StoreError("Autofix plans require an observed failed run", 409);
  let evidence;
  try {
    evidence = await tracebackStore.read(`evidence/runs/${runId}.json`);
  } catch (e: any) {
    if (e.code === "ENOENT")
      throw new StoreError("Autofix requires a canonical journey run", 409);
    throw e;
  }
  const journey = await tracebackStore.get(evidence.journeyId);
  if (journey.revision !== evidence.revision)
    throw new StoreError(
      "Journey changed since the failure. Reproduce before planning a fix.",
      409,
    );
  const logs = await db
    .select()
    .from(schema.activityLogs)
    .where(eq(schema.activityLogs.runId, runId));
  const id = uid();
  const plan = {
    schemaVersion: 1,
    id,
    status: "awaiting-congruence-adapter",
    createdAt: now(),
    repository: process.env.GITHUB_REPOSITORY || null,
    baseCommit: null,
    journey: {
      id: journey.id,
      revision: journey.revision,
      definitionHash: evidence.definitionHash,
    },
    failure: {
      runId,
      finding: run.keyFinding,
      screenshots: logs
        .filter((x) => x.screenshotUrl)
        .map((x) => x.screenshotUrl),
    },
    workflow: [
      "Resolve repository and pin base commit",
      "Create isolated branch/worktree",
      "Reproduce the failing journey against the base commit",
      "Ask Congruence for a bounded code patch",
      "Reject secret, workflow, and canonical expected-outcome edits",
      "Run type checks and repository tests",
      "Rerun the same journey, persona, and viewport against the patched app",
      "Run adjacent journeys and compare evidence",
      "Open a draft PR with diff, before/after evidence, and test results",
    ],
    policy: {
      maxFiles: 10,
      maxAttempts: 2,
      denyPaths: [
        ".env*",
        ".github/workflows/**",
        ".traceback/journeys/**",
        ".traceback/ontology.json",
      ],
      autoMerge: false,
      requireReproduction: true,
      requireIndependentRerun: true,
    },
    adapter: {
      provider: "congruence.dev",
      configured: false,
      notice:
        "No Congruence API contract or credentials are configured. This is an executable-workflow specification, not a claimed code fix or PR.",
    },
  };
  await tracebackStore.write(`autofix/plans/${id}.json`, plan);
  return plan;
}
