# MCP and CLI

MCP is the primary automation interface. Both transports call the same authenticated API used by the GUI; they do not maintain another copy of journey intent.

## Install and connect

```sh
npm ci
npm link
traceback --help
```

Create a workspace API key in Settings. Supply it as `TRACEBACK_API_KEY` through your MCP client's environment-secret configuration. Supply the server URL as `TRACEBACK_API_URL`. Never paste keys into a journey or commit them to a client configuration file.

Example stdio client configuration, with the key injected separately by the host:

```json
{
  "mcpServers": {
    "traceback": {
      "command": "traceback",
      "args": ["mcp"],
      "env": { "TRACEBACK_API_URL": "http://localhost:3001" }
    }
  }
}
```

Without a global link, use `node /absolute/path/to/Tracebackqaharness/bin/traceback.mjs mcp`. The wrapper resolves its own TypeScript runtime, so it also works from another working directory. MCP stdout contains protocol messages only; failures go to stderr or structured tool errors.

Remote clients can use stateless Streamable HTTP at `/api/mcp`, with `Authorization: Bearer <workspace-api-key>`. POST is supported; persistent SSE sessions are not. Production remote MCP requires an API key even if the browser has an owner login cookie. Revoked keys lose access on subsequent requests.

## Tools and resources

| Workflow | Tools |
| --- | --- |
| Intent | `list_journeys`, `get_journey`, `save_journey`, `get_ontology`, `save_ontology` |
| Execution | `run_journey`, `get_run`, `control_run`, `read_evidence_screenshot` |
| Investigation | `search_traceback`, `analyze_journey` |
| Discovery | `discover_source_routes`, `discover_github_routes`, `map_browser_routes`, `get_route_map`, `cancel_route_map` |
| Draft mapping | `import_route_map`, `infer_journey_drafts` |
| GitHub | `create_journey_pr` |
| Repair planning | `prepare_autofix` |

Resources: `traceback://ontology` and `traceback://journeys/{id}`. The `review-journey` prompt directs clients to source actual evidence, distinguish stale revisions, and avoid changing expected outcomes to hide failures.

Screenshot tools return actual PNG image content, with a 5 MB limit. Mutating tools declare their behavior in MCP annotations. Creating a GitHub PR publishes externally and requires explicit user intent; execution may interact with the target application. Use disposable environments for exploratory synthetic journeys.

## CLI workflow

```sh
traceback init --root .traceback
traceback journeys list
traceback journeys save journey.json
traceback journeys get checkout
traceback journeys save edited-journey.json --revision 1
traceback journeys run checkout --persona mobile --budget 40
traceback run RUN_ID
traceback journeys analyze checkout
traceback search checkout
traceback routes
traceback routes --github
traceback map http://host.docker.internal:4010 --max-pages 8
traceback map-status MAP_ID
traceback map-import MAP_ID
traceback map-infer MAP_ID
traceback ontology --file ontology.json
traceback autofix-plan FAILED_RUN_ID
traceback github-pr
```

`run`, mapping, and inference commands return IDs or structured results; they do not silently wait until completion. Poll the corresponding status command. Existing definitions require an expected revision for saves, and conflicts return a nonzero CLI exit code instead of overwriting a newer definition.
