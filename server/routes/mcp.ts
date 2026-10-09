import { Router } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "../../interfaces/mcp";
import { TracebackClient } from "../../interfaces/api-client";
export const mcpRouter = Router();
mcpRouter.post("/", async (req, res) => {
  const key = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;
  if (process.env.TRACEBACK_PASSWORD && !key)
    return res
      .status(401)
      .json({ error: "Remote MCP requires a workspace API key" });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createMcpServer(
    new TracebackClient(`http://127.0.0.1:${process.env.PORT || 3001}`, key),
  );
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent)
      res.status(500).json({ error: "MCP transport failed" });
  }
});
mcpRouter.all("/", (_req, res) =>
  res
    .status(405)
    .set("Allow", "POST")
    .json({ error: "Use stateless Streamable HTTP POST or the stdio CLI" }),
);
