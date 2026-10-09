export class TracebackClient {
  constructor(
    readonly base = process.env.TRACEBACK_API_URL || "http://localhost:3001",
    readonly key = process.env.TRACEBACK_API_KEY,
  ) {
    const url = new URL(base);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("Use an HTTP(S) API URL without embedded credentials");
  }
  async request(endpoint: string, method = "GET", body?: unknown) {
    const response = await fetch(
      this.base.replace(/\/$/, "") + "/api/" + endpoint,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(this.key ? { Authorization: `Bearer ${this.key}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      },
    );
    const data = await response
      .json()
      .catch(() => ({ error: "Server returned an unreadable response" }));
    if (!response.ok)
      throw new Error(`${response.status}: ${data.error || "Request failed"}`);
    return data;
  }
  async screenshot(name: string) {
    if (!/^(?:map-)?[a-f0-9-]{36}-\d+\.png$/.test(name))
      throw new Error("Invalid screenshot artifact name");
    const r = await fetch(
      this.base.replace(/\/$/, "") + "/api/artifacts/" + name,
      {
        headers: this.key ? { Authorization: `Bearer ${this.key}` } : {},
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!r.ok) throw new Error(`Screenshot unavailable (${r.status})`);
    if (!r.headers.get("content-type")?.startsWith("image/png"))
      throw new Error("Artifact is not a PNG screenshot");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of r.body as any) {
      size += chunk.length;
      if (size > 5_000_000)
        throw new Error("Screenshot exceeds the MCP image size limit");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("base64");
  }
}
