#!/usr/bin/env -S node --import tsx
import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { TracebackClient } from "./api-client";
import { TracebackStore, identifier } from "../server/lib/traceback-store";
import { startMcp } from "./mcp";
const program = new Command()
  .name("traceback")
  .version("2.1.0")
  .description("Canonical journeys, Steel QA evidence, and MCP")
  .option(
    "--api <url>",
    "Traceback API URL",
    process.env.TRACEBACK_API_URL || "http://localhost:3001",
  );
const client = () => new TracebackClient(program.opts().api);
const print = (value: unknown): void => {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
};
const id = (v: string) => identifier.parse(v);
program
  .command("init")
  .option("--root <directory>", "Canonical folder", ".traceback")
  .action(async (o) => {
    const store = new TracebackStore(o.root);
    await store.init();
    print({ sourceOfTruth: store.root });
  });
const journeys = program.command("journeys");
journeys
  .command("list")
  .option("--query <text>", "Search canonical definitions", "")
  .action(async (o) =>
    print(await client().request("journeys?q=" + encodeURIComponent(o.query))),
  );
journeys
  .command("get <id>")
  .action(async (v) => print(await client().request("journeys/" + id(v))));
journeys
  .command("save <file>")
  .option("--revision <number>", "Expected revision for an update")
  .action(async (file, o) => {
    const j = JSON.parse(await readFile(file, "utf8"));
    id(j.id);
    print(
      await client().request(
        "journeys" + (o.revision ? "/" + j.id : ""),
        o.revision ? "PUT" : "POST",
        { ...j, revision: Number(o.revision || 1) },
      ),
    );
  });
journeys
  .command("run <id>")
  .option(
    "--persona <name>",
    "standard, first-time, mobile, keyboard",
    "standard",
  )
  .option("--budget <number>", "Action budget", "50")
  .action(async (v, o) =>
    print(
      await client().request(`journeys/${id(v)}/run`, "POST", {
        persona: o.persona,
        budget: Number(o.budget),
      }),
    ),
  );
journeys
  .command("analyze <id>")
  .action(async (v) =>
    print(await client().request(`journeys/${id(v)}/analysis`)),
  );
program
  .command("search <query>")
  .action(async (q) =>
    print(await client().request("journeys/search?q=" + encodeURIComponent(q))),
  );
program
  .command("routes")
  .option("--github", "Inspect the configured GitHub repository")
  .action(async (o) =>
    print(
      await client().request(
        o.github ? "journeys/github/routes" : "journeys/source-routes",
      ),
    ),
  );
program
  .command("map <url>")
  .option("--max-pages <number>", "Bounded page observations", "8")
  .action(async (url, o) =>
    print(
      await client().request("journeys/maps", "POST", {
        entryPoint: url,
        maxPages: Number(o.maxPages),
      }),
    ),
  );
program
  .command("map-status <id>")
  .action(async (v) => print(await client().request("journeys/maps/" + id(v))));
program
  .command("map-import <id>")
  .action(async (v) =>
    print(await client().request(`journeys/maps/${id(v)}/import`, "POST")),
  );
program
  .command("map-infer <id>")
  .action(async (v) =>
    print(await client().request(`journeys/maps/${id(v)}/infer`, "POST")),
  );
program
  .command("map-cancel <id>")
  .action(async (v) =>
    print(await client().request(`journeys/maps/${id(v)}/cancel`, "POST")),
  );
program
  .command("run <id>")
  .action(async (v) => print(await client().request("runs/" + id(v))));
program
  .command("control <id> <action>")
  .option("--extra-credits <number>")
  .action(async (v, action, o) => {
    if (!["pause", "resume", "abort"].includes(action))
      throw new Error("Use pause, resume, or abort");
    print(
      await client().request(`runs/${id(v)}/${action}`, "POST", {
        extraCredits: o.extraCredits ? Number(o.extraCredits) : undefined,
      }),
    );
  });
program
  .command("ontology")
  .option("--file <file>", "Validate and save ontology from JSON")
  .action(async (o) =>
    print(
      await client().request(
        "journeys/ontology",
        o.file ? "PUT" : "GET",
        o.file ? JSON.parse(await readFile(o.file, "utf8")) : undefined,
      ),
    ),
  );
program
  .command("github-pr")
  .description("Publish canonical journeys to a new branch and PR")
  .action(async () =>
    print(await client().request("journeys/github/sync", "POST")),
  );
program
  .command("autofix-plan <runId>")
  .action(async (v) =>
    print(await client().request("journeys/autofix", "POST", { runId: id(v) })),
  );
program
  .command("mcp")
  .description(
    "Start the MCP stdio server; stdout contains protocol messages only",
  )
  .action(async () => startMcp(client()));
try {
  await program.parseAsync(process.argv);
} catch (e) {
  process.stderr.write(
    (e instanceof Error ? e.message : "Command failed") + "\n",
  );
  process.exitCode = 1;
}
