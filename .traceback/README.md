# Canonical QA intent

`.traceback` is the source of truth for journey definitions and the product ontology. Each journey lives in `journeys/<id>/journey.json`. The files in this repository describe Traceback's own workflows and remain authored drafts; checking a file into Git is not passing QA evidence.

`ontology.json` defines actors, entities, routes, and relations. Static routes carry `observed: false`. A browser map can contribute observations, but observed reachability does not establish complete business journey coverage. IDs and relationship endpoints are validated on writes. Referenced actors cannot be removed while journeys depend on them.

Definitions use schema version 1 and optimistic revisions. Preserve the meaning of expected outcomes when repairing code. Store credential references such as `{{TEST_PASSWORD}}`, never actual passwords. Starting URLs cannot embed credentials.

Runtime evidence under `evidence/`, prepared repair plans under `autofix/plans/`, and the transient write lock are ignored by Git. Runs store an immutable definition snapshot, revision, SHA-256 hash, and synthetic profile in evidence; SQLite holds their action logs and result records. A newer definition makes older run evidence stale. GitHub publication includes only journey JSON and ontology, never runtime evidence or secrets.

The self-QA targets use `host.docker.internal:3001`, because the browser runs inside Steel. Configure the target so that it is reachable from Steel and provide the appropriate test credentials. Use a disposable deployment; some authored workflows create QA records. Source route placeholders such as `:id` require actual record prerequisites. The authored drafts are not executed automatically on startup.

See `docs/mcp-cli.md` for the primary automation interface and `docs/autofix.md` for the planned Congruence repair loop. Use one application process per canonical folder. Back up canonical files, SQLite, and runtime evidence together. If the process is force-killed during a canonical write, stop all writers and remove the abandoned `.write-lock` directory before restarting.
