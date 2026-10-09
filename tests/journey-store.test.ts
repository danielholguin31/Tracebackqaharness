import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { TracebackStore, journeySchema } from "../server/lib/traceback-store";
const definition = {
  id: "checkout",
  name: "Checkout",
  entryPoint: "http://localhost:4010",
  expectedOutcome: "Order confirmation is visible",
  steps: [
    {
      order: 0,
      type: "assert",
      action: "Check confirmation",
      target: "#result",
      value: "Order confirmed",
      css: true,
    },
  ],
};
test("canonical store preserves revisions, rejects stale writes, validates ontology references and blocks symlinks", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "traceback-store-"));
  const store = new TracebackStore(path.join(temp, ".traceback"));
  try {
    await store.init();
    const original = await store.save(definition);
    assert.equal(original.revision, 1);
    assert.equal((await store.list("confirmation")).length, 1);
    assert.equal(
      (await store.save({ ...original, name: "Updated" }, 1)).revision,
      2,
    );
    await assert.rejects(
      store.save({ ...original, name: "Stale" }, 1),
      /changed/,
    );
    assert.equal((await store.get("checkout")).name, "Updated");
    await assert.rejects(store.get("../private"), /Invalid/);
    assert.equal(
      journeySchema.safeParse({
        ...definition,
        entryPoint: "https://owner:secret@example.com",
      }).success,
      false,
    );
    const ontology = await store.ontology();
    await assert.rejects(
      store.saveOntology({ ...ontology, actors: [] }),
      /referencing/,
    );
    await assert.rejects(
      store.saveOntology({
        ...ontology,
        relations: [{ from: "workspace-owner", to: "unknown", type: "uses" }],
      }),
      /endpoints/,
    );
    await mkdir(path.join(temp, "outside"));
    await symlink(
      path.join(temp, "outside"),
      path.join(store.root, "journeys", "escape"),
    );
    await assert.rejects(
      store.save({ ...definition, id: "escape" }),
      /Symlinks/,
    );
    const canonical = JSON.parse(
      await readFile(
        path.join(store.root, "journeys", "checkout", "journey.json"),
        "utf8",
      ),
    );
    assert.equal(canonical.revision, 2);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
