import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { stepSchema, url } from "./validation";

export const identifier = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
export const journeySchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    id: identifier,
    name: z.string().trim().min(1).max(200),
    description: z.string().max(4000).default(""),
    entryPoint: url,
    actor: z.string().min(1).max(100).default("workspace-owner"),
    mode: z.enum(["deterministic", "autonomous"]).default("deterministic"),
    goal: z.string().max(4000).default(""),
    expectedOutcome: z.string().min(1).max(2000),
    routes: z.array(z.string().max(300)).max(100).default([]),
    tags: z.array(z.string().max(60)).max(30).default([]),
    steps: z.array(stepSchema).max(100).default([]),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    provenance: z
      .object({
        kind: z.enum([
          "authored",
          "static-route",
          "observed-link",
          "model-inference",
        ]),
        evidence: z.string().max(500).optional(),
      })
      .default({ kind: "authored" }),
    revision: z.number().int().positive().default(1),
  })
  .superRefine((j, ctx) => {
    const target = new URL(j.entryPoint);
    if (target.username || target.password)
      ctx.addIssue({
        code: "custom",
        path: ["entryPoint"],
        message:
          "Use credential references instead of embedding URL credentials",
      });
    if (new Set(j.steps.map((s) => s.order)).size !== j.steps.length)
      ctx.addIssue({
        code: "custom",
        path: ["steps"],
        message: "Step order values must be unique",
      });
    if (j.mode === "deterministic" && !j.steps.length)
      ctx.addIssue({
        code: "custom",
        path: ["steps"],
        message: "At least one deterministic step is required",
      });
    if (j.mode === "autonomous" && !j.goal.trim())
      ctx.addIssue({
        code: "custom",
        path: ["goal"],
        message: "An autonomous goal is required",
      });
  });
export type Journey = z.infer<typeof journeySchema>;
export const ontologySchema = z.object({
  schemaVersion: z.literal(1).default(1),
  actors: z
    .array(
      z.object({
        id: identifier,
        name: z.string().min(1),
        description: z.string().default(""),
      }),
    )
    .max(100),
  entities: z
    .array(
      z.object({
        id: identifier,
        name: z.string().min(1),
        description: z.string().default(""),
      }),
    )
    .max(500),
  routes: z
    .array(
      z.object({
        path: z.string().min(1),
        source: z.string(),
        observed: z.boolean().default(false),
      }),
    )
    .max(2000),
  relations: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        type: z.enum(["uses", "visits", "depends-on", "produces"]),
      }),
    )
    .max(2000),
});
export const defaultOntology = {
  schemaVersion: 1,
  actors: [
    {
      id: "workspace-owner",
      name: "Workspace owner",
      description: "Authenticated owner of the QA workspace",
    },
  ],
  entities: [],
  routes: [],
  relations: [],
};
export class StoreError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export class TracebackStore {
  readonly root: string;
  constructor(root = process.env.TRACEBACK_ROOT || path.resolve(".traceback")) {
    this.root = path.resolve(root);
  }
  async file(relative: string, create = false) {
    if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes(".."))
      throw new StoreError("Invalid canonical path");
    if (create) await fs.mkdir(this.root, { recursive: true });
    const rootReal = await fs.realpath(this.root);
    if (rootReal !== this.root)
      throw new StoreError("Canonical root must not be a symlink");
    let current = this.root;
    for (const segment of relative.split("/")) {
      current = path.join(current, segment);
      try {
        if ((await fs.lstat(current)).isSymbolicLink())
          throw new StoreError("Symlinks are not supported in .traceback");
      } catch (e: any) {
        if (e.code !== "ENOENT") throw e;
      }
    }
    return current;
  }
  async read(relative: string) {
    const filename = await this.file(relative);
    const stat = await fs.stat(filename);
    if (stat.size > 2_000_000)
      throw new StoreError("Canonical file exceeds the size limit");
    return JSON.parse(await fs.readFile(filename, "utf8"));
  }
  async write(relative: string, data: unknown) {
    const filename = await this.file(relative, true);
    await fs.mkdir(path.dirname(filename), { recursive: true });
    const temporary = `${filename}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(data, null, 2) + "\n", {
        mode: 0o600,
      });
      await fs.rename(temporary, filename);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
  async locked<T>(action: () => Promise<T>): Promise<T> {
    const lock = await this.file(".write-lock", true);
    try {
      await fs.mkdir(lock);
    } catch (e: any) {
      if (e.code === "EEXIST")
        throw new StoreError("Canonical store is busy. Retry the write.", 409);
      throw e;
    }
    try {
      return await action();
    } finally {
      await fs.rmdir(lock);
    }
  }
  async init() {
    await this.locked(async () => {
      try {
        await this.read("ontology.json");
      } catch (e: any) {
        if (e.code !== "ENOENT") throw e;
        await this.write("ontology.json", defaultOntology);
      }
      await fs.mkdir(await this.file("journeys", true), { recursive: true });
    });
  }
  async list(q = "") {
    let entries;
    try {
      entries = await fs.readdir(await this.file("journeys"), {
        withFileTypes: true,
      });
    } catch (e: any) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
    const journeys: Journey[] = [];
    for (const entry of entries
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      identifier.parse(entry.name);
      const j = await this.get(entry.name);
      if (j.id !== entry.name)
        throw new StoreError("Journey ID does not match its directory");
      if (JSON.stringify(j).toLowerCase().includes(q.toLowerCase()))
        journeys.push(j);
    }
    return journeys;
  }
  async get(id: string): Promise<Journey> {
    identifier.parse(id);
    try {
      return journeySchema.parse(
        await this.read(`journeys/${id}/journey.json`),
      );
    } catch (e: any) {
      if (e.code === "ENOENT") throw new StoreError("Journey not found", 404);
      throw e;
    }
  }
  async save(input: unknown, expectedRevision?: number) {
    const j = journeySchema.parse(input);
    return this.locked(async () => {
      let existing: Journey | undefined;
      try {
        existing = await this.get(j.id);
      } catch (e: any) {
        if (e.status !== 404) throw e;
      }
      if (existing && expectedRevision !== existing.revision)
        throw new StoreError("Journey changed. Reload before saving.", 409);
      if (!existing && expectedRevision !== undefined)
        throw new StoreError("Journey does not exist", 404);
      const ontology = await this.ontology();
      if (!ontology.actors.some((a) => a.id === j.actor))
        throw new StoreError("Actor must exist in the ontology");
      j.revision = existing ? existing.revision + 1 : 1;
      await this.write(`journeys/${j.id}/journey.json`, j);
      return j;
    });
  }
  async ontology() {
    try {
      return ontologySchema.parse(await this.read("ontology.json"));
    } catch (e: any) {
      if (e.code === "ENOENT") return ontologySchema.parse(defaultOntology);
      throw e;
    }
  }
  async saveOntology(input: unknown) {
    const o = ontologySchema.parse(input);
    return this.locked(async () => {
      const ids = [...o.actors, ...o.entities].map((x) => x.id);
      if (new Set(ids).size !== ids.length)
        throw new StoreError("Ontology IDs must be unique");
      const valid = new Set([...ids, ...o.routes.map((x) => x.path)]);
      for (const j of await this.list())
        if (!o.actors.some((a) => a.id === j.actor))
          throw new StoreError(
            "Ontology still has journeys referencing this actor",
            409,
          );
      for (const edge of o.relations)
        if (!valid.has(edge.from) || !valid.has(edge.to))
          throw new StoreError("Ontology relation endpoints must exist");
      await this.write("ontology.json", o);
      return o;
    });
  }
}
export const tracebackStore = new TracebackStore();
