import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TracebackClient } from "./api-client";
import {
  identifier,
  journeySchema,
  ontologySchema,
} from "../server/lib/traceback-store";
import { mappingSchema } from "../server/lib/journey-mapping-schema";

export function createMcpServer(client = new TracebackClient()) {
  const server = new McpServer({ name: "traceback", version: "2.1.0" });
  const output = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });
  const read = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  const write = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  };
  server.registerTool(
    "read_evidence_screenshot",
    {
      description:
        "Return a real run or route-map PNG as MCP image content. Pass the artifact filename from the observed screenshot URL.",
      inputSchema: {
        artifact: z.string().regex(/^(?:map-)?[a-f0-9-]{36}-\d+\.png$/),
      },
      annotations: read,
    },
    async ({ artifact }) => {
      try {
        return {
          content: [
            {
              type: "image" as const,
              mimeType: "image/png",
              data: await client.screenshot(artifact),
            },
          ],
        };
      } catch (e) {
        return {
          ...output({
            error:
              e instanceof Error ? e.message : "Screenshot could not be read",
          }),
          isError: true,
        };
      }
    },
  );
  const tool = (
    name: string,
    description: string,
    inputSchema: any,
    fn: (input: any) => Promise<unknown>,
    annotations = read,
  ) =>
    server.registerTool(
      name,
      { description, inputSchema, annotations },
      async (input) => {
        try {
          return output(await fn(input));
        } catch (e) {
          return {
            ...output({
              error: e instanceof Error ? e.message : "Operation failed",
            }),
            isError: true,
          };
        }
      },
    );
  tool(
    "list_journeys",
    "Read canonical .traceback journeys. Optional text search.",
    { query: z.string().max(200).optional() },
    (i) => client.request("journeys?q=" + encodeURIComponent(i.query || "")),
  );
  tool(
    "get_journey",
    "Read a canonical journey definition and its revision.",
    { id: identifier },
    (i) => client.request("journeys/" + i.id),
  );
  tool(
    "save_journey",
    "Create or update a canonical journey. Existing journeys require expectedRevision; conflicts never overwrite newer definitions.",
    {
      journey: journeySchema,
      expectedRevision: z.number().int().positive().optional(),
    },
    (i) =>
      client.request(
        "journeys" + (i.expectedRevision ? "/" + i.journey.id : ""),
        i.expectedRevision ? "PUT" : "POST",
        { ...i.journey, revision: i.expectedRevision || 1 },
      ),
    write,
  );
  tool(
    "run_journey",
    "Execute a canonical journey in a real Steel browser. Synthetic personas are not real users. Returns run IDs for polling.",
    {
      id: identifier,
      persona: z
        .enum(["standard", "first-time", "mobile", "keyboard"])
        .default("standard"),
      budget: z.number().int().min(2).max(1000).default(50),
    },
    (i) =>
      client.request(`journeys/${i.id}/run`, "POST", {
        persona: i.persona,
        budget: i.budget,
      }),
    { ...write, openWorldHint: true },
  );
  tool(
    "get_run",
    "Read actual status, logs, screenshots and reports.",
    { id: identifier },
    (i) => client.request("runs/" + i.id),
  );
  tool(
    "control_run",
    "Pause, resume, or cancel an existing run. Resume can extend its action budget.",
    {
      id: identifier,
      action: z.enum(["pause", "resume", "abort"]),
      extraCredits: z.number().int().positive().max(1000).optional(),
    },
    (i) =>
      client.request(`runs/${i.id}/${i.action}`, "POST", {
        extraCredits: i.extraCredits,
      }),
    write,
  );
  tool(
    "analyze_journey",
    "Read evidence-backed synthetic UX findings. Stale definition revisions are flagged.",
    { id: identifier },
    (i) => client.request(`journeys/${i.id}/analysis`),
  );
  tool(
    "search_traceback",
    "Search journeys, ontology, runs and issue evidence.",
    { query: z.string().max(200) },
    (i) => client.request("journeys/search?q=" + encodeURIComponent(i.query)),
  );
  tool(
    "get_ontology",
    "Read actors, entities, routes, and relations from .traceback/ontology.json.",
    {},
    () => client.request("journeys/ontology"),
  );
  tool(
    "save_ontology",
    "Validate and save ontology; referenced actors and relation endpoints must exist.",
    { ontology: ontologySchema },
    (i) => client.request("journeys/ontology", "PUT", i.ontology),
    write,
  );
  tool(
    "discover_source_routes",
    "Inspect configured source repository routes. Static discovery does not establish business journey coverage.",
    {},
    () => client.request("journeys/source-routes"),
  );
  tool(
    "discover_github_routes",
    "Inspect route candidates in the configured GitHub repository. Requires repository credentials; bounded scan, not verified business coverage.",
    {},
    () => client.request("journeys/github/routes"),
    { ...read, openWorldHint: true },
  );
  tool(
    "map_browser_routes",
    "Observe a bounded same-origin link traversal through Steel. It visits URLs; it does not submit forms or establish complete journey coverage.",
    mappingSchema.shape,
    (i) => client.request("journeys/maps", "POST", i),
    { ...write, openWorldHint: true },
  );
  tool(
    "get_route_map",
    "Read mapping progress, observations, screenshots, and remaining URLs.",
    { id: identifier },
    (i) => client.request("journeys/maps/" + i.id),
  );
  tool(
    "cancel_route_map",
    "Cancel queued or active mapping at the next browser boundary.",
    { id: identifier },
    (i) => client.request(`journeys/maps/${i.id}/cancel`, "POST"),
    write,
  );
  tool(
    "import_route_map",
    "Import completed observations as draft canonical reachability checks. Review expected outcomes before trusting coverage.",
    { id: identifier },
    (i) => client.request(`journeys/maps/${i.id}/import`, "POST"),
    write,
  );
  tool(
    "infer_journey_drafts",
    "Use configured AI to propose business journey hypotheses from completed observations. All output remains unverified drafts; no success or coverage is claimed.",
    { id: identifier },
    (i) => client.request(`journeys/maps/${i.id}/infer`, "POST"),
    { ...write, openWorldHint: true },
  );
  tool(
    "create_journey_pr",
    "Publish canonical .traceback definitions to a new GitHub branch and PR. Never includes runtime evidence or secrets. Explicit user intent to publish is required.",
    {},
    () => client.request("journeys/github/sync", "POST"),
    { ...write, openWorldHint: true },
  );
  tool(
    "prepare_autofix",
    "Prepare a Congruence autofix workflow for an observed canonical journey failure. Does not edit code or create a repair PR until an adapter is configured.",
    { runId: identifier },
    (i) => client.request("journeys/autofix", "POST", i),
    write,
  );
  server.registerResource(
    "ontology",
    "traceback://ontology",
    { description: "Canonical product ontology", mimeType: "application/json" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            await client.request("journeys/ontology"),
            null,
            2,
          ),
        },
      ],
    }),
  );
  server.registerResource(
    "journeys",
    new ResourceTemplate("traceback://journeys/{id}", {
      list: async () => ({
        resources: (await client.request("journeys")).items.map((j: any) => ({
          uri: `traceback://journeys/${j.id}`,
          name: j.name,
          mimeType: "application/json",
        })),
      }),
    }),
    {
      description: "Canonical journey definitions",
      mimeType: "application/json",
    },
    async (uri, { id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            await client.request("journeys/" + identifier.parse(id)),
            null,
            2,
          ),
        },
      ],
    }),
  );
  server.registerPrompt(
    "review-journey",
    {
      description:
        "Review observed evidence without inventing coverage or human UX metrics",
      argsSchema: { id: identifier },
    },
    ({ id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Review canonical journey ${id}. Use get_journey and analyze_journey. Distinguish stale evidence, product failure, and infrastructure blocks. Cite run IDs and screenshots. Propose explicit definition changes; do not change expected outcomes to hide failures. Synthetic evidence is not human satisfaction data.`,
          },
        },
      ],
    }),
  );
  return server;
}
export async function startMcp(client = new TracebackClient()) {
  await createMcpServer(client).connect(new StdioServerTransport());
}
