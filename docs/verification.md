# Verification scope

Validation uses a disposable checkout fixture reached from an actual upstream Steel Docker browser. No OpenAI or integration credentials were available. Passing deterministic execution does not establish autonomous model quality or hosted deployment readiness.

## Browser routes

Desktop (1440×1000) and mobile (390×844): overview, usage, events and missing event, toolbox, both editors, test library and missing test, initializing and live run views, run history and missing report, suites/new/detail/missing suite report, issues/missing issue, settings, design system, workspace entry, operator, personal settings/toolbox/home, missing project, and unknown-route handling.

Persisted projects cover overview, tests, runs, issues, suites, settings, and toolbox. Additional flows verify editor validation and saved goal, actual test/suite/run detail, report/issue/trace tabs, team/project test separation, project creation through the dialog, and an injected API outage with retry affordance. Route checks catch frontend exceptions and missing-record behavior; they do not exhaust every possible interaction or target website.

## API and runner edges

- Owner login, HttpOnly cookie, unauthorized API/artifact access, foreign mutation origin, create/list/revoke API keys, and owner removal protection.
- URL/definition validation, pagination normalization, duplicate viewport normalization, encrypted credential round-trip and tamper rejection.
- Missing run handling and malformed definitions.
- Real assertion failure produces an issue and screenshot.
- Budget exhaustion pauses; extension resumes without repeating earlier actions.
- Completed runs refuse resume; paused runs can be cancelled.
- Three saved viewport choices produce three browser runs.
- Empty suites fail validation; populated suites finish with actual aggregate results.

Production TypeScript checks and Vite compilation are separate checks. GitHub CI repeats unit, runner, browser, and build verification with the pinned Steel image. See the workflow for exact setup.

## Dependency audit

Inherited runtime vulnerabilities were patched, including the Drizzle ORM update to 0.45.4. `npm audit --omit=dev` reports zero vulnerabilities at verification time. The development-only Drizzle Kit loader still pulls an older esbuild with a moderate development-server advisory; do not expose development tooling publicly. The production frontend build also emits a bundle-size warning (~894 KB before compression); route-level code splitting remains a performance improvement.

## Recorded local result

On 2026-10-09, frontend/backend TypeScript checks, all four unit/security tests, the actual Steel runner regression, all 88 desktop/mobile browser checks, Vite production build, Docker build on Node 22, and the production container startup/authentication smoke check passed. The smoke check caught and verified a fix for non-root file ownership in the image. Live model behavior and third-party exports remain unverified without credentials.

## v2.1 canonical/MCP verification

The expanded verification adds canonical file revisions, stale-write rejection, actor/relation validation, symlink rejection, source and GitHub route discovery, inference provenance and unobserved-route rejection, canonical-only GitHub tree export, actual MCP stdio negotiation, authenticated stateless HTTP MCP, screenshot image content, and the installed CLI entrypoint. The real Steel journey regression uses an isolated database/canonical folder and tests mobile execution, stale UX evidence, failed-run fix planning, bounded mapping, idempotent draft import, and cancellation.

Desktop/mobile browser coverage adds journey routes, guided intent editing, JSON errors, stale saves, actual synthetic execution and UX evidence, source/ontology operations, route map import, unavailable inference, API recovery, evidence search, configured integration controls with fixture responses, and Operator iframe isolation. Tablet/light/dark checks verify no document overflow and measured muted-text contrast. [Anti-slop evidence](anti-slop-verification.md) records the scoped gate and click-through.

A full pass of 114 browser checks completed before the last four additional checks. The first pass of those new checks had one local ERR_NETWORK_CHANGED interruption while Docker altered the network; the complete suite was rerun after container work finished. See the final recorded result below rather than treating the interrupted pass as successful.

### Final v2.1 local result, 2026-10-09

All 118 desktop/mobile browser checks passed together after the network stabilized. Frontend/backend/interface TypeScript checks, eight unit/security/MCP/adapter tests, both actual Steel regressions, production Vite compilation, Docker build, and production container startup/authentication smoke checks passed. The CLI was linked and invoked through its installed command; MCP returned actual Steel screenshot PNG content in the isolated journey regression. `npm audit --omit=dev` reported zero runtime vulnerabilities. Live model quality and live GitHub/Linear publication remain unverified without credentials; GitHub and inference contracts are covered by fixture adapters. Congruence execution remains a planned external adapter, as requested.

## Agent workspace, 2026-10-09

The home route is the persistent agent workspace. Chats and GUI are two sidebar modes; saved conversations resume by URL, drafts survive GUI navigation, New chat resets state, and GUI context can be attached or dismissed. Project views share the same shell. The former Operator route is a compatibility alias, with no separate Operator navigation/page.

The expanded 124-check desktop/mobile suite passed 123 checks in one run. A concurrent targeted test process removed the shared trace output directory during the last check; that mobile project-creation check passed in an isolated rerun. The four agent-workspace checks also passed separately after the final context changes. Eight unit/security/MCP/adapter tests, TypeScript checks, and the production build passed. Fresh screenshots show both sidebar modes and mobile navigation. Live model responses remain unverified without OPENAI_API_KEY.
