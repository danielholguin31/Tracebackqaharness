import { db, schema } from "../db";
import { eq, desc } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";
import { tracebackStore, StoreError } from "./traceback-store";
import { uid, now, WORKSPACE_ID } from "./helpers";
import { createRuns } from "./create-run";
import { executeRun } from "./runner";

export const simulationSchema = z.object({
  persona: z
    .enum(["standard", "first-time", "mobile", "keyboard"])
    .default("standard"),
  budget: z.number().int().min(2).max(1000).default(50),
});
export const personas = {
  standard: { label: "Standard browser", viewport: "desktop", instruction: "" },
  "first-time": {
    label: "First-time synthetic user",
    viewport: "desktop",
    instruction:
      "Use only visible information; do not assume prior knowledge of the interface. Report unclear labels and missing guidance.",
  },
  mobile: {
    label: "Mobile synthetic user",
    viewport: "mobile",
    instruction:
      "Use the mobile interface and report inaccessible controls, clipped content, and confusing navigation.",
  },
  keyboard: {
    label: "Keyboard review",
    viewport: "desktop",
    instruction:
      "Use press actions with value Tab, Shift+Tab, Enter, Space, Escape, or arrow keys to navigate. Never click. Inspect the focused element in the DOM evidence and reach the goal using keyboard actions. Report focus traps and inaccessible controls. Do not claim keyboard support without observing it.",
  },
} as const;
export async function runJourney(id: string, input: unknown = {}) {
  const options = simulationSchema.parse(input);
  const journey = await tracebackStore.get(id);
  if (journey.status === "archived")
    throw new StoreError("Archived journeys cannot run", 409);
  if (journey.mode === "autonomous" && !process.env.OPENAI_API_KEY)
    throw new StoreError(
      "Configure OPENAI_API_KEY before running an autonomous journey",
      503,
    );
  if (options.persona === "keyboard" && journey.mode === "deterministic")
    throw new StoreError(
      "Keyboard persona requires an autonomous journey; mouse-based deterministic steps cannot establish keyboard usability",
      400,
    );
  const persona = personas[options.persona];
  const testId = uid();
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.tests)
      .values({
        id: testId,
        workspaceId: WORKSPACE_ID,
        name: journey.name,
        mode: journey.mode,
        entryPoint: journey.entryPoint,
        customPrompt: [
          options.persona === "keyboard" ? "[keyboard-only]" : "",
          journey.goal,
          journey.expectedOutcome,
          persona.instruction,
        ]
          .filter(Boolean)
          .join("\n"),
        environment: "local",
        runnerMode: "standard",
        viewportJson: JSON.stringify({
          mode: "single",
          single: persona.viewport,
        }),
        estimatedCredits: options.budget,
        triggersJson: "{}",
        defaultReportsJson: "[]",
        createdAt: now(),
      });
    for (const step of journey.steps)
      await tx
        .insert(schema.testSteps)
        .values({
          ...step,
          id: uid(),
          testId,
          order: step.order!,
          action: step.action!,
        });
  });
  const [definition] = await db
    .select()
    .from(schema.tests)
    .where(eq(schema.tests.id, testId));
  const runs = await createRuns(definition, { triggeredBy: "operator" });
  for (const run of runs) {
    await tracebackStore.write(`evidence/runs/${run.id}.json`, {
      runId: run.id,
      journeyId: id,
      revision: journey.revision,
      definitionHash: createHash("sha256")
        .update(JSON.stringify(journey))
        .digest("hex"),
      persona: options.persona,
      createdAt: now(),
      snapshot: journey,
    });
    void executeRun(run.id).catch(console.error);
  }
  return {
    runIds: runs.map((r) => r.id),
    journeyId: id,
    revision: journey.revision,
    persona: options.persona,
    simulation: true,
  };
}
function seconds(timestamp: string) {
  const values = timestamp.split(":").map(Number);
  if (values.some((v) => !Number.isFinite(v))) return 0;
  return values.reduce((t, v) => t * 60 + v, 0);
}
export function frictionFromLogs(run: any, logs: any[]) {
  const findings: {
    kind: string;
    severity: string;
    message: string;
    step?: number;
    screenshotUrl?: string;
  }[] = [];
  if (run.status === "failed")
    findings.push({
      kind: "blocked-outcome",
      severity: "high",
      message: run.keyFinding || "The expected outcome was not reached.",
    });
  if (run.status === "blocked")
    findings.push({
      kind: "infrastructure",
      severity: "info",
      message:
        run.keyFinding ||
        "Execution was blocked. This is not a measured product failure.",
    });
  let previous = 0;
  const actions = new Map<string, number>();
  for (const log of logs) {
    const time = seconds(log.timestamp);
    const interval = time - previous;
    previous = time;
    if (interval >= 5)
      findings.push({
        kind: "slow-interval",
        severity: "medium",
        message: `${interval}s between recorded observations. Includes browser execution and screenshot capture; not a human completion time.`,
        step: log.step,
        screenshotUrl: log.screenshotUrl,
      });
    const action = log.action || "";
    if (/^(click|fill|wait) /.test(action)) {
      const count = (actions.get(action) || 0) + 1;
      actions.set(action, count);
      if (count === 3)
        findings.push({
          kind: "repeated-interaction",
          severity: "medium",
          message:
            "The synthetic runner repeated this interaction three times. Review for a loop or unclear outcome.",
          step: log.step,
          screenshotUrl: log.screenshotUrl,
        });
    }
  }
  return findings;
}
export async function journeyAnalysis(id: string) {
  const journey = await tracebackStore.get(id);
  const runs = await db
    .select()
    .from(schema.runs)
    .orderBy(desc(schema.runs.startedAt));
  const matching = [];
  for (const run of runs) {
    let evidence;
    try {
      evidence = await tracebackStore.read(`evidence/runs/${run.id}.json`);
    } catch (e: any) {
      if (e.code === "ENOENT") continue;
      throw e;
    }
    if (evidence.journeyId !== id) continue;
    const logs = (
      await db
        .select()
        .from(schema.activityLogs)
        .where(eq(schema.activityLogs.runId, run.id))
    ).sort((a, b) => a.step - b.step);
    matching.push({
      ...run,
      persona: evidence.persona,
      revision: evidence.revision,
      stale: evidence.revision !== journey.revision,
      findings: frictionFromLogs(run, logs),
      activityLog: logs,
    });
    if (matching.length >= 20) break;
  }
  return {
    journey,
    runs: matching,
    coverage: matching.some(
      (r) => !r.stale && ["passed", "healed"].includes(r.status),
    )
      ? "verified"
      : "unverified",
    disclaimer:
      "Synthetic browser evidence identifies review candidates. It does not measure real user satisfaction or conversion.",
  };
}
export async function searchTraceback(query: string) {
  const q = query.toLowerCase();
  const journeys = await tracebackStore.list(q);
  const ontology = await tracebackStore.ontology();
  const runs = await db
    .select()
    .from(schema.runs)
    .orderBy(desc(schema.runs.startedAt));
  const issues = await db
    .select()
    .from(schema.issues)
    .orderBy(desc(schema.issues.createdAt));
  return {
    journeys,
    entities: ontology.entities.filter((x) =>
      JSON.stringify(x).toLowerCase().includes(q),
    ),
    routes: ontology.routes.filter((x) => x.path.toLowerCase().includes(q)),
    runs: runs
      .filter((x) => `${x.testName} ${x.keyFinding}`.toLowerCase().includes(q))
      .slice(0, 30),
    issues: issues
      .filter((x) => `${x.title} ${x.evidence}`.toLowerCase().includes(q))
      .slice(0, 30),
  };
}
