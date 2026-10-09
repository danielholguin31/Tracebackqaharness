# Anti-slop verification for the v2.1 surfaces

Scope: the new journey library/editor/detail, mapping, ontology, UX evidence, and the changed Operator artifact renderer. This report does not claim a complete accessibility or interaction audit of every inherited component. Direction is recorded in DESIGN.md; review screenshots and the browser tests alongside these checks.

## Hard gate

- R-02 PASS: new interface copy uses ordinary sentences without decorative em dashes.
- R-03 PASS: browser checks enforce no document overflow at desktop/mobile; tablet checks cover both themes. The mobile screenshot shows wrapped canonical paths and one-column reflow.
- R-17/R-18/R-36/R-38 PASS: counts come from API records and observations; no testimonials, human UX scores, or fabricated security/performance claims are introduced. Authored and inferred journeys are explicitly drafts.
- R-23 PASS: product direction came from the user; assets are screenshots of the running application, not generated customers or invented branding.
- R-24 PASS: new navigation opens implemented journey, ontology, UX, and Operator routes; missing IDs have explicit error states.
- R-25 PASS: browser checks measure muted journey text at at least 4.5:1 in light and dark themes. New text uses the shared foreground/muted tokens; no text is placed over an uncontrolled image or gradient.
- R-26 PASS: authoring, revision saves, source discovery, ontology save, mapping/import, unavailable inference, search, synthetic run, configured GitHub controls, and artifact follow-up/dismiss actions have recorded browser behavior. Mapping cancellation is also exercised against the actual API/worker. No new inert control is shipped.
- R-27 PASS: tests cover empty evidence, loading, missing records, malformed JSON, stale revisions, unavailable AI, and injected API failure with retry.
- R-28 PASS: no generic FAQ was added.
- R-32 PASS: labels associate with form controls; semantic tabs/buttons are keyboard reachable; the focus check moves through the search controls. Shared focus-visible styling remains enabled.
- R-33 PASS: features were implemented in source using patches; no runtime source/CSS rewriting utility implements the new UI. Formatting does not introduce features.
- R-34 PASS: both host themes are exercised, and the isolated artifact adapter maps the host theme into its upstream theme styles.
- R-35 PASS: TypeScript checks, production compilation, real Steel workflows, production container startup, and desktop/mobile interactions were run. One browser interruption traced to ERR_NETWORK_CHANGED during Docker work was rerun after the network stabilized.
- R-37 PASS: the requested Linear/Notion/early-Apple monitoring direction and inferred dials were declared before building.

## Purpose gate

- R-01/R-09/R-12/R-13 PASS: neutral tactile controls support action boundaries; status labels show real definition/run state. New evidence lists have no decorative glow or floating card grid.
- R-04 PASS: the new screens use text for intent and evidence; navigation glyphs represent relevant existing destination types.
- R-06 PASS: heading, body, and log/path typography have separate readability purposes recorded in DESIGN.md.
- R-07/R-08/R-10/R-14/R-19/R-22 PASS: no new background grid, stock illustration, decorative arrow system, page-wide glass, repetitive feature mosaic, or looping animation was added.

## Liveliness

- PASS: ENERGY 2 / RHYTHM 2 / MOTION 1 is declared. Evidence lists and narrower action rails vary the reading structure without a marketing template.
- PASS: expected outcome is the focal point; whitespace separates intent, source path, revision, and evidence.
- PASS: the primary control is the deliberate accent; canonical path/revision rows form the repeated product motif.

## Craft and quality locks

- C-1/C-3/R-05/R-20/R-30/R-31 PASS: composition serves a QA investigation, with rationale for typography, rails, separators, and hierarchy. References inform it without copying a whole product layout.
- C-2/C-4/C-5 PASS: controls have real actions, tested failure states, responsive layouts, and source-grounded data.
- R-11/R-15/R-16/R-21/R-29 PASS: radii distinguish controls and artifacts; action labels name their operation; both themes work; neutral surfaces reserve emphasis for actual state and action. No new marketing buzzwords or unsourced claims were added.

## Recorded click-through

New journey opens the editor. Malformed JSON shows an error. Create persists a canonical file and navigates to detail. Definition tab opens stored fields. Save increments the revision. Stale save refuses overwrite. Mobile profile creates a real Steel run and actual evidence. Source discovery displays candidates; ontology save persists them. Invalid ontology JSON shows an error. Browser map displays observed screenshots; import creates draft checks. Inference without credentials shows the required configuration error. Search finds actual records. Configured GitHub controls are exercised with fixture API responses; adapter tests separately verify base-tree preservation and canonical-only export. The artifact fixture cannot access the host DOM; trusted follow-up requests require a host button, and dismiss clears them. Live model quality and live third-party publication remain unverified without credentials.
