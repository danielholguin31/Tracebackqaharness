import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../interfaces/mcp";
import { TracebackClient } from "../interfaces/api-client";

class MockClient extends TracebackClient {
  requests: any[] = [];
  override async request(endpoint: string, method = "GET", body?: unknown) {
    this.requests.push({ endpoint, method, body });
    if (endpoint === "journeys/missing")
      throw new Error("404: Journey not found");
    if (endpoint === "journeys/ontology")
      return {
        schemaVersion: 1,
        actors: [],
        entities: [],
        routes: [],
        relations: [],
      };
    if (endpoint.startsWith("journeys?q=")) return { items: [] };
    return { ok: true };
  }
}
test("MCP negotiates, exposes canonical tools/resources, validates inputs and reports API errors", async () => {
  const api = new MockClient();
  const server = createMcpServer(api);
  const client = new Client({ name: "qa", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  try {
    const list = await client.listTools();
    assert.ok(list.tools.some((t) => t.name === "run_journey"));
    assert.ok(list.tools.some((t) => t.name === "prepare_autofix"));
    assert.equal(
      (
        await client.callTool({
          name: "get_journey",
          arguments: { id: "missing" },
        })
      ).isError,
      true,
    );
    assert.equal(
      (
        await client.callTool({
          name: "get_journey",
          arguments: { id: "../private" },
        })
      ).isError,
      true,
    );
    await client.callTool({
      name: "run_journey",
      arguments: { id: "checkout", persona: "mobile", budget: 12 },
    });
    assert.deepEqual(api.requests.at(-1), {
      endpoint: "journeys/checkout/run",
      method: "POST",
      body: { persona: "mobile", budget: 12 },
    });
    assert.equal(
      (await client.readResource({ uri: "traceback://ontology" })).contents[0]
        .mimeType,
      "application/json",
    );
    assert.ok(
      (
        await client.getPrompt({
          name: "review-journey",
          arguments: { id: "checkout" },
        })
      ).messages[0].content,
    );
  } finally {
    await client.close();
    await server.close();
  }
});
test("installed CLI serves clean MCP stdio and forwards API credentials", async () => {
  const api = http.createServer((req, res) => {
    assert.equal(req.headers.authorization, "Bearer test-only-api-key");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ items: [], sourceOfTruth: ".traceback" }));
  });
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  const port = (api.address() as any).port;
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["bin/traceback.mjs", "mcp"],
    env: {
      ...env,
      TRACEBACK_API_URL: `http://127.0.0.1:${port}`,
      TRACEBACK_API_KEY: "test-only-api-key",
    },
    stderr: "pipe",
  });
  let errors = "";
  transport.stderr?.on("data", (b) => (errors += String(b)));
  const client = new Client({ name: "qa-stdio", version: "1" });
  try {
    await client.connect(transport);
    const result: any = await client.callTool({
      name: "list_journeys",
      arguments: {},
    });
    assert.equal(
      JSON.parse(result.content[0].text).sourceOfTruth,
      ".traceback",
    );
    assert.equal(errors, "");
  } finally {
    await client.close();
    await transport.close();
    await new Promise<void>((resolve) => api.close(() => resolve()));
  }
});
