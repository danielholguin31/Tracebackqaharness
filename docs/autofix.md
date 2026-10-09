# Congruence autofix plan

Traceback identifies an observed failure and supplies canonical intent and evidence. Congruence owns code editing. Native QA harnesses remain execution engines; `.traceback` retains the expected product behavior.

The current implementation prepares a bounded workflow specification from a failed canonical journey run. It refuses non-failing runs and failures from stale definition revisions. Plans include the journey revision and definition hash, actual failure text, screenshot references, attempt limits, forbidden paths, and required reproduction/rerun gates. GUI, CLI, MCP, and Operator use the same planner. No code patch, successful rerun, or repair PR is claimed by the planner.

## Adapter contract to agree with Congruence

Input must include a repository identifier, pinned base commit, isolated worktree/branch identifier, canonical journey snapshot and hash, synthetic profile/viewport, failed run ID, evidence bundle, allowed edit scope, excluded paths, test commands, and callback/cancellation identifiers. Credentials are passed by the worker's secret store, never inside the plan or model context.

A job emits durable events: queued, reproducing, editing, validating, rerunning, reviewing, draft-PR-created, blocked, cancelled. Each event identifies the job, attempt, timestamps, immutable base commit, and evidence references. Job creation and callbacks require idempotency keys and authenticated, replay-resistant signatures. The callback must not be able to overwrite canonical outcomes or mark a run passed without independent runner evidence.

## Required loop

1. Resolve repository access and pin the base commit. Create an isolated branch/worktree.
2. Launch the base application in an isolated test environment. Reproduce the same journey, revision, profile, and viewport. If reproduction fails because of infrastructure, stop with a block.
3. Ask Congruence for a bounded patch. Limit to ten files and two attempts initially. Exclude credentials, CI workflows, journey expected outcomes, and ontology changes.
4. Review the diff against policy, then run repository type checks and tests.
5. Launch the patched application and independently rerun the exact failing journey through Steel. Compare screenshots and outcome evidence. Never heal the expected assertion to manufacture a pass.
6. Run adjacent journeys identified by ontology dependencies. Include regressions and any unverified coverage in the result.
7. Open a draft PR containing the patch, base commit, root-cause hypothesis, before/after run links, test commands and results, and remaining uncertainty. Keep merge review with the owner. Never auto-merge.

Cancellation terminates the worker environment and browser session, preserving evidence and diff. Restart recovery must reconcile durable worker state rather than retrying a code edit blindly. Ambiguous callbacks, changed base commits, changed journey revisions, exhausted budgets, and invalid patch scopes block the job.

## Current external dependency

As checked on 2026-10-09, congruence.dev exposes a launching-soon page, not a published integration contract. No endpoint or authentication scheme is assumed. A Congruence API specification and worker configuration are required before implementing or verifying live edit/retest/PR execution. The existing `prepare_autofix` tool honestly reports `awaiting-congruence-adapter`.
