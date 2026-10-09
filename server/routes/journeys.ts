import { Router } from "express";
import { z } from "zod";
import { tracebackStore, StoreError, identifier } from "../lib/traceback-store";
import {
  journeyAnalysis,
  runJourney,
  searchTraceback,
  personas,
} from "../lib/journey-services";
import {
  discoverSourceRoutes,
  startMapping,
  importMapping,
} from "../lib/journey-mapping";
import {
  githubRepositoryStatus,
  syncCanonicalToGithub,
  prepareAutofix,
  discoverGithubRoutes,
} from "../lib/journey-github";
import { inferJourneyDrafts } from "../lib/journey-inference";

export const journeysRouter = Router();
const handle =
  (fn: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      res
        .status(e instanceof z.ZodError ? 400 : e.status || 500)
        .json({
          error:
            e instanceof z.ZodError
              ? e.issues
                  .map((i) => `${i.path.join(".")}: ${i.message}`)
                  .join("; ")
              : e.status
                ? e.message
                : "Journey operation failed. Check the server configuration and canonical files.",
        });
    }
  };
journeysRouter.get(
  "/",
  handle(async (req, res) =>
    res.json({
      items: await tracebackStore.list(String(req.query.q || "")),
      sourceOfTruth: ".traceback",
      personas,
    }),
  ),
);
journeysRouter.post(
  "/",
  handle(async (req, res) =>
    res.status(201).json(await tracebackStore.save(req.body)),
  ),
);
journeysRouter.get(
  "/ontology",
  handle(async (_req, res) => res.json(await tracebackStore.ontology())),
);
journeysRouter.put(
  "/ontology",
  handle(async (req, res) =>
    res.json(await tracebackStore.saveOntology(req.body)),
  ),
);
journeysRouter.get(
  "/search",
  handle(async (req, res) =>
    res.json(
      await searchTraceback(
        z
          .string()
          .max(200)
          .parse(req.query.q || ""),
      ),
    ),
  ),
);
journeysRouter.get(
  "/source-routes",
  handle(async (_req, res) => res.json(await discoverSourceRoutes())),
);
journeysRouter.get(
  "/github",
  handle(async (_req, res) => res.json(await githubRepositoryStatus())),
);
journeysRouter.get(
  "/github/routes",
  handle(async (_req, res) => res.json(await discoverGithubRoutes())),
);
journeysRouter.post(
  "/github/sync",
  handle(async (_req, res) =>
    res.status(201).json(await syncCanonicalToGithub()),
  ),
);
journeysRouter.post(
  "/maps",
  handle(async (req, res) =>
    res.status(202).json(await startMapping(req.body)),
  ),
);
journeysRouter.get(
  "/maps/:id",
  handle(async (req, res) => {
    identifier.parse(req.params.id);
    try {
      res.json(
        await tracebackStore.read(`evidence/maps/${req.params.id}.json`),
      );
    } catch (e: any) {
      if (e.code === "ENOENT") throw new StoreError("Map not found", 404);
      throw e;
    }
  }),
);
journeysRouter.post(
  "/maps/:id/import",
  handle(async (req, res) => {
    identifier.parse(req.params.id);
    res.json(await importMapping(req.params.id));
  }),
);
journeysRouter.post(
  "/maps/:id/infer",
  handle(async (req, res) =>
    res.json(await inferJourneyDrafts(identifier.parse(req.params.id))),
  ),
);
journeysRouter.post(
  "/maps/:id/cancel",
  handle(async (req, res) => {
    identifier.parse(req.params.id);
    let job;
    try {
      job = await tracebackStore.read(`evidence/maps/${req.params.id}.json`);
    } catch (e: any) {
      if (e.code === "ENOENT") throw new StoreError("Map not found", 404);
      throw e;
    }
    if (!["queued", "running"].includes(job.status))
      throw new StoreError("Map is already terminal", 409);
    await tracebackStore.write(
      `evidence/maps/${req.params.id}.cancelled.json`,
      { cancelled: true },
    );
    await tracebackStore.write(`evidence/maps/${req.params.id}.json`, {
      ...job,
      status: "cancelled",
    });
    res.json({ status: "cancelled" });
  }),
);
journeysRouter.post(
  "/autofix",
  handle(async (req, res) =>
    res
      .status(201)
      .json(await prepareAutofix(z.string().min(1).parse(req.body.runId))),
  ),
);
journeysRouter.get(
  "/:id",
  handle(async (req, res) => res.json(await tracebackStore.get(req.params.id))),
);
journeysRouter.put(
  "/:id",
  handle(async (req, res) => {
    if (req.params.id !== req.body.id)
      throw new StoreError("Journey ID cannot change");
    res.json(
      await tracebackStore.save(
        req.body,
        z.number().int().positive().parse(req.body.revision),
      ),
    );
  }),
);
journeysRouter.get(
  "/:id/analysis",
  handle(async (req, res) => res.json(await journeyAnalysis(req.params.id))),
);
journeysRouter.post(
  "/:id/run",
  handle(async (req, res) =>
    res.status(201).json(await runJourney(req.params.id, req.body)),
  ),
);
