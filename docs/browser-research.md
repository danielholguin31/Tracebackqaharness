# Browser and QA architecture research

V2 uses [steel-dev/steel-browser](https://github.com/steel-dev/steel-browser) for browser infrastructure, not an alternative browser host. Upstream source was inspected at commit `1131a0222a27f391bf8f27cca6f278ddf7ace8dd`. The tested distribution is pinned in Compose and CI to image digest `sha256:459919842ab1aac5201e33331fc070a13106edd26d968fc7551adcff334b54cf`. Steel is Apache-2.0 licensed; its source and distribution remain separate from this repository.

The adapter creates sessions through `/v1/sessions`, connects Playwright to the returned CDP endpoint, captures browser evidence, and releases each session even after errors or cancellation. The self-hosted Steel service has one active browser; V2 serializes browser ownership accordingly. Saved desktop, tablet, and mobile selections become distinct runs and suite results.

| Repository studied | Relevant pattern | V2 application |
| --- | --- | --- |
| [browserbase/stagehand](https://github.com/browserbase/stagehand) | Structured browser actions alongside deterministic browser APIs. | Zod-validated atomic actions; explicit steps use Playwright directly, while natural-language goals use a bounded decision loop. |
| [browser-use/browser-use](https://github.com/browser-use/browser-use) | Observe browser state, choose an action, execute, then observe again. | Screenshot and DOM evidence are supplied for each decision; action history is bounded and selectors are validated by execution. |
| [QAWolf/qawolf](https://github.com/QAWolf/qawolf) | Browser testing and repeatable automation workflows. | Repeatable route tests, real-browser regression fixtures, and retained failure screenshots and traces in CI. |

These repositories informed architecture. No source files from them were copied. Steel remains the browser provider; the V2 runner and adapters are authored here. Third-party libraries retain their upstream licenses.

The runner never treats page text as instructions, never evaluates generated JavaScript, and limits navigation to the starting origin. The agent signals completion based on observed state. Deterministic assertions check visible elements and expected text directly. Configuration and service failures become blocked runs; failed product checks produce issue records with observed evidence.

Self-healing is opt-in, constrained to the original action type and value, and tested before continuing. A repair affects only the current run until the owner explicitly applies it. Applying checks that the definition’s selector has not changed since the run.
