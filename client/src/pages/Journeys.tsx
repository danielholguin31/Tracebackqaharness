import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";

async function api(route: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/journeys" + route, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
function Failure({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div role="alert" className="v2-state">
      <h2>This operation could not finish.</h2>
      <p>{error instanceof Error ? error.message : String(error)}</p>
      {retry && (
        <button className="btn-precision btn-secondary" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
function Page({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Layout>
      <div className="journey-workspace">
        <header className="journey-heading">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <nav aria-label="Journey navigation">
            <Link href="/journeys">Journeys</Link>
            <Link href="/ontology">Ontology</Link>
            <Link href="/ux">UX evidence</Link>
          </nav>
        </header>
        {children}
      </div>
    </Layout>
  );
}

const newDefinition = {
  schemaVersion: 1,
  id: "",
  name: "",
  entryPoint: "",
  actor: "workspace-owner",
  mode: "deterministic",
  expectedOutcome: "",
  goal: "",
  routes: [],
  tags: [],
  status: "draft",
  steps: [
    {
      order: 0,
      type: "assert",
      action: "Check the expected content",
      target: "h1",
      value: "",
      css: true,
    },
  ],
  provenance: { kind: "authored" },
  revision: 1,
};
function DefinitionEditor({
  definition,
  isNew = false,
  onSaved,
}: {
  definition: any;
  isNew?: boolean;
  onSaved: (j: any) => void;
}) {
  const [draft, setDraft] = useState(definition);
  const [steps, setSteps] = useState(JSON.stringify(definition.steps, null, 2));
  const [error, setError] = useState<any>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDraft(definition);
    setSteps(JSON.stringify(definition.steps, null, 2));
  }, [definition.id]);
  const update = (key: string, value: unknown) =>
    setDraft((d: any) => ({ ...d, [key]: value }));
  return (
    <form
      className="journey-definition"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(undefined);
        try {
          const saved = await api(
            isNew ? "" : "/" + draft.id,
            isNew ? "POST" : "PUT",
            { ...draft, steps: JSON.parse(steps) },
          );
          onSaved(saved);
        } catch (err) {
          setError(err);
        } finally {
          setSaving(false);
        }
      }}
    >
      {error && <Failure error={error} />}
      <div className="journey-form-grid">
        <label>
          Journey ID
          <input
            required
            pattern="[a-z0-9][a-z0-9-]{0,79}"
            disabled={!isNew}
            value={draft.id}
            onChange={(e) => update("id", e.target.value)}
          />
        </label>
        <label>
          Name
          <input
            required
            value={draft.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </label>
        <label>
          Starting URL
          <input
            required
            type="url"
            value={draft.entryPoint}
            onChange={(e) => update("entryPoint", e.target.value)}
          />
        </label>
        <label>
          Actor ID
          <input
            required
            value={draft.actor}
            onChange={(e) => update("actor", e.target.value)}
          />
        </label>
        <label>
          Execution mode
          <select
            value={draft.mode}
            onChange={(e) => update("mode", e.target.value)}
          >
            <option value="deterministic">Defined steps</option>
            <option value="autonomous">Autonomous goal</option>
          </select>
        </label>
        <label>
          Definition status
          <select
            value={draft.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>
      <label>
        Expected outcome
        <textarea
          required
          rows={2}
          value={draft.expectedOutcome}
          onChange={(e) => update("expectedOutcome", e.target.value)}
        />
      </label>
      {draft.mode === "autonomous" && (
        <label>
          Goal
          <textarea
            required
            rows={3}
            value={draft.goal}
            onChange={(e) => update("goal", e.target.value)}
          />
        </label>
      )}
      <label>
        Routes, one per line
        <textarea
          rows={2}
          value={draft.routes.join("\n")}
          onChange={(e) =>
            update("routes", e.target.value.split("\n").filter(Boolean))
          }
        />
      </label>
      <label>
        Tags, separated by commas
        <input
          value={draft.tags.join(", ")}
          onChange={(e) =>
            update(
              "tags",
              e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            )
          }
        />
      </label>
      <label>
        Step definitions (JSON)
        <textarea
          className="journey-code"
          rows={10}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          spellCheck={false}
        />
      </label>
      <p className="journey-note">
        Supported actions: navigate, click, fill, assert, wait, screenshot. Use
        CSS selectors with css: true. Credentials use secret references, never
        literal passwords.
      </p>
      <button className="btn-precision btn-primary" disabled={saving}>
        {saving
          ? "Saving canonical definition…"
          : isNew
            ? "Create journey"
            : "Save revision"}
      </button>
    </form>
  );
}
export function NewJourney() {
  const [, navigate] = useLocation();
  return (
    <Page
      title="New journey"
      description="Save the expected behavior in a versioned .traceback folder."
    >
      <DefinitionEditor
        definition={newDefinition}
        isNew
        onSaved={(j) => navigate("/journeys/" + j.id)}
      />
    </Page>
  );
}

export function JourneyLibrary() {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const [entryPoint, setEntryPoint] = useState("");
  const [pages, setPages] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<any>();
  const [notice, setNotice] = useState("");
  const [sources, setSources] = useState<any>();
  const library = useQuery({
    queryKey: ["canonical-journeys", query],
    queryFn: () => api("?q=" + encodeURIComponent(query)),
  });
  const search = useQuery({
    queryKey: ["traceback-search", query],
    queryFn: () => api("/search?q=" + encodeURIComponent(query)),
    enabled: query.trim().length > 0,
  });
  const github = useQuery({
    queryKey: ["journey-github"],
    queryFn: () => api("/github"),
  });
  const operate = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="User journeys"
      description="Canonical intent in .traceback. Observed evidence in each run."
    >
      <div className="journey-toolbar">
        <label className="journey-search">
          Search journeys and evidence
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Route, outcome, issue, or journey"
          />
        </label>
        <Link className="btn-precision btn-primary" href="/journeys/new">
          New journey
        </Link>
      </div>
      {error && <Failure error={error} />}{" "}
      {notice && (
        <p role="status" className="journey-notice">
          {notice}
        </p>
      )}
      <div className="journey-columns">
        <section>
          <h2>Canonical definitions</h2>
          {library.isLoading ? (
            <p role="status">Reading journey folders…</p>
          ) : library.error ? (
            <Failure
              error={library.error}
              retry={() => void library.refetch()}
            />
          ) : !library.data.items.length ? (
            <div className="v2-state">
              <h3>
                {query ? "No matching journeys" : "No journeys defined yet"}
              </h3>
              <p>
                Create a journey or map an application and review the draft
                outcomes.
              </p>
            </div>
          ) : (
            library.data.items.map((j: any) => (
              <Link
                className="journey-row"
                key={j.id}
                href={"/journeys/" + j.id}
              >
                <div>
                  <strong>{j.name}</strong>
                  <p>{j.expectedOutcome}</p>
                  <code>.traceback/journeys/{j.id}/journey.json</code>
                </div>
                <span>
                  {j.status}
                  <small>revision {j.revision}</small>
                </span>
              </Link>
            ))
          )}
          {query && (
            <section className="journey-evidence-search">
              <h2>Matching runtime evidence</h2>
              {search.error ? (
                <Failure error={search.error} />
              ) : search.isLoading ? (
                <p>Searching logs…</p>
              ) : (
                <>
                  {search.data?.runs.map((r: any) => (
                    <Link
                      className="journey-row"
                      key={r.id}
                      href={"/runs/" + r.id}
                    >
                      <strong>{r.testName}</strong>
                      <span>{r.status}</span>
                    </Link>
                  ))}
                  {search.data?.issues.map((i: any) => (
                    <Link
                      className="journey-row"
                      key={i.id}
                      href={"/issues/" + i.id}
                    >
                      {i.title}
                    </Link>
                  ))}
                  {!search.data?.runs.length && !search.data?.issues.length && (
                    <p>No matching runs or issues.</p>
                  )}
                </>
              )}
            </section>
          )}
        </section>
        <aside>
          <h2>Map an application</h2>
          <p className="journey-note">
            Observe same-origin links through Steel. Forms are not submitted.
            Imported checks remain drafts until reviewed.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void operate(async () => {
                const job = await api("/maps", "POST", {
                  entryPoint,
                  maxPages: pages,
                });
                navigate("/journeys/maps/" + job.id);
              });
            }}
          >
            <label>
              Application URL
              <input
                required
                type="url"
                value={entryPoint}
                onChange={(e) => setEntryPoint(e.target.value)}
              />
            </label>
            <label>
              Page limit
              <input
                type="number"
                min={1}
                max={20}
                value={pages}
                onChange={(e) => setPages(Number(e.target.value))}
              />
            </label>
            <button className="btn-precision btn-secondary" disabled={busy}>
              Start browser map
            </button>
          </form>
          <h2>Source routes</h2>
          <p className="journey-note">
            Inspect the repository configured on the server. Static routes are
            candidates, not passing tests.
          </p>
          <button
            className="btn-precision btn-secondary"
            disabled={busy}
            onClick={() =>
              void operate(async () => setSources(await api("/source-routes")))
            }
          >
            Discover source routes
          </button>
          {github.data?.configured && (
            <button
              className="btn-precision btn-secondary"
              disabled={busy}
              onClick={() =>
                void operate(async () =>
                  setSources(await api("/github/routes")),
                )
              }
            >
              Discover GitHub routes
            </button>
          )}
          {sources && (
            <>
              <p>
                {sources.routes.length} routes from {sources.filesInspected}{" "}
                files{sources.truncated ? ", scan limit reached" : ""}.
              </p>
              <ul className="journey-route-list">
                {sources.routes.map((r: any) => (
                  <li key={r.path}>
                    <code>{r.path}</code>
                    <small>{r.source}</small>
                  </li>
                ))}
              </ul>
              <button
                className="btn-precision btn-secondary"
                disabled={busy}
                onClick={() =>
                  void operate(async () => {
                    const o = await api("/ontology");
                    o.routes = [
                      ...new Map(
                        [...o.routes, ...sources.routes].map((r: any) => [
                          r.path,
                          r,
                        ]),
                      ).values(),
                    ];
                    await api("/ontology", "PUT", o);
                    setNotice("Static routes saved in the ontology.");
                  })
                }
              >
                Save routes to ontology
              </button>
            </>
          )}
          <h2>GitHub</h2>
          {github.isLoading ? (
            <p>Checking integration…</p>
          ) : github.error ? (
            <Failure error={github.error} />
          ) : github.data?.configured ? (
            <>
              <p>{github.data.repository}</p>
              <button
                className="btn-precision btn-secondary"
                disabled={busy}
                onClick={() =>
                  void operate(async () => {
                    const pr = await api("/github/sync", "POST");
                    setNotice(
                      pr.unchanged
                        ? "Canonical definitions already match GitHub."
                        : `Journey PR created: ${pr.url}`,
                    );
                  })
                }
              >
                Create journey PR
              </button>
            </>
          ) : (
            <p className="journey-note">
              Configure GITHUB_TOKEN and GITHUB_REPOSITORY on the server to
              publish canonical folders through a reviewed PR.
            </p>
          )}
        </aside>
      </div>
    </Page>
  );
}

export function JourneyDetail({ id }: { id: string }) {
  const client = useQueryClient();
  const data = useQuery({
    queryKey: ["journey-analysis", id],
    queryFn: () => api("/" + id + "/analysis"),
    refetchInterval: 3000,
  });
  const [tab, setTab] = useState("evidence");
  const [persona, setPersona] = useState("standard");
  const [budget, setBudget] = useState(50);
  const [error, setError] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<any>();
  const [, navigate] = useLocation();
  if (data.isLoading)
    return (
      <Page
        title="Journey"
        description="Reading canonical definition and run evidence."
      >
        <p role="status">Loading journey…</p>
      </Page>
    );
  if (data.error)
    return (
      <Page
        title="Journey unavailable"
        description="The definition could not be read."
      >
        <Failure error={data.error} retry={() => void data.refetch()} />
      </Page>
    );
  const j = data.data.journey;
  return (
    <Page title={j.name} description={j.expectedOutcome}>
      <div className="journey-toolbar">
        <code>
          .traceback/journeys/{j.id}/journey.json · revision {j.revision}
        </code>
        <Link
          href={"/operator?journey=" + encodeURIComponent(id)}
          className="btn-precision btn-secondary"
        >
          Ask Operator
        </Link>
      </div>
      <div className="journey-tabs" role="tablist">
        {["evidence", "definition"].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t === "evidence" ? "UX evidence and runs" : "Definition"}
          </button>
        ))}
      </div>
      {error && <Failure error={error} />}
      {tab === "definition" ? (
        <DefinitionEditor
          definition={j}
          onSaved={(saved) => {
            client.setQueryData(["journey-analysis", id], (old: any) => ({
              ...old,
              journey: saved,
            }));
            void client.invalidateQueries({ queryKey: ["canonical-journeys"] });
            setTab("evidence");
          }}
        />
      ) : (
        <div className="journey-columns">
          <section>
            <h2>
              {data.data.coverage === "verified"
                ? "Current revision has passing evidence"
                : "Current revision is unverified"}
            </h2>
            <p className="journey-note">{data.data.disclaimer}</p>
            {!data.data.runs.length ? (
              <div className="v2-state">
                <h3>No synthetic runs yet</h3>
                <p>
                  Run a browser profile to collect actions, screenshots, and
                  review candidates.
                </p>
              </div>
            ) : (
              data.data.runs.map((r: any) => (
                <article className="journey-run" key={r.id}>
                  <header>
                    <Link href={"/runs/" + r.id}>
                      {r.persona} · {r.status}
                    </Link>
                    <span>
                      {r.stale ? "Older definition" : "Current revision"} ·{" "}
                      {r.startedAt}
                    </span>
                  </header>
                  <p>{r.keyFinding || "Waiting for browser evidence"}</p>
                  {r.findings.map((f: any, i: number) => (
                    <div className="journey-finding" key={i}>
                      <strong>{f.kind}</strong>
                      <p>{f.message}</p>
                      {f.screenshotUrl && (
                        <a
                          href={f.screenshotUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View observed screenshot
                        </a>
                      )}
                    </div>
                  ))}
                  {r.status === "failed" && (
                    <button
                      className="btn-precision btn-secondary"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError(undefined);
                        try {
                          setPlan(
                            await api("/autofix", "POST", { runId: r.id }),
                          );
                        } catch (e) {
                          setError(e);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Prepare Congruence fix plan
                    </button>
                  )}
                </article>
              ))
            )}
            {plan && (
              <section>
                <h2>Autofix plan</h2>
                <p>{plan.adapter.notice}</p>
                <ol>
                  {plan.workflow.map((step: string) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <details>
                  <summary>Review adapter payload and policy</summary>
                  <pre className="journey-json">
                    {JSON.stringify(plan, null, 2)}
                  </pre>
                </details>
              </section>
            )}
          </section>
          <aside>
            <h2>Run a synthetic profile</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError(undefined);
                try {
                  const result = await api("/" + id + "/run", "POST", {
                    persona,
                    budget,
                  });
                  navigate("/runs/" + result.runIds[0]);
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Browser profile
                <select
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                >
                  <option value="standard">Standard browser</option>
                  <option value="first-time">First-time synthetic user</option>
                  <option value="mobile">Mobile synthetic user</option>
                  <option value="keyboard">Keyboard review (autonomous)</option>
                </select>
              </label>
              <label>
                Action budget
                <input
                  type="number"
                  min={2}
                  max={1000}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                />
              </label>
              <button
                className="btn-precision btn-primary"
                disabled={busy || j.status === "archived"}
              >
                {busy ? "Starting…" : "Run journey"}
              </button>
            </form>
            <p className="journey-note">
              Deterministic profiles replay the defined steps at the selected
              viewport. First-time behavior and keyboard review require an
              autonomous definition and AI credentials. These are synthetic
              checks, not human research.
            </p>
            <h2>Mapped routes</h2>
            <ul>
              {j.routes.map((route: string) => (
                <li key={route}>
                  <code>{route}</code>
                </li>
              ))}
            </ul>
            <p>Actor: {j.actor}</p>
          </aside>
        </div>
      )}
    </Page>
  );
}

export function RouteMap({ id }: { id: string }) {
  const data = useQuery({
    queryKey: ["route-map", id],
    queryFn: () => api("/maps/" + id),
    refetchInterval: (q) =>
      ["queued", "running"].includes(q.state.data?.status) ? 1000 : false,
  });
  const [error, setError] = useState<any>();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (action: string) => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await api(`/maps/${id}/${action}`, "POST");
      setNotice(result.notice || "Mapping cancelled.");
      void data.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="Browser route map"
      description="Observed links and controls from a bounded Steel session."
    >
      {data.isLoading ? (
        <p role="status">Reading map status…</p>
      ) : data.error ? (
        <Failure error={data.error} retry={() => void data.refetch()} />
      ) : (
        <>
          <div className="journey-toolbar">
            <p role="status">
              {data.data.status} · {data.data.pages.length} pages observed
            </p>
            {["queued", "running"].includes(data.data.status) && (
              <button
                className="btn-precision btn-secondary"
                disabled={busy}
                onClick={() => void act("cancel")}
              >
                Cancel mapping
              </button>
            )}
            {data.data.status === "completed" && (
              <button
                className="btn-precision btn-primary"
                disabled={busy}
                onClick={() => void act("import")}
              >
                Import draft journeys
              </button>
            )}
            {data.data.status === "completed" && (
              <button
                className="btn-precision btn-secondary"
                disabled={busy}
                onClick={() => void act("infer")}
              >
                Infer journey hypotheses
              </button>
            )}
          </div>
          {data.data.error && <Failure error={data.data.error} />}{" "}
          {error && <Failure error={error} />}{" "}
          {notice && (
            <p role="status">
              {notice} <Link href="/journeys">View journeys</Link>
            </p>
          )}
          {data.data.truncated && (
            <p>
              The page limit was reached. {data.data.remainingUrls.length}{" "}
              discovered URLs remain unobserved.
            </p>
          )}
          {data.data.pages.map((p: any) => (
            <article className="journey-run" key={p.url}>
              <h2>{p.heading || p.title || p.url}</h2>
              <code>{p.url}</code>
              {p.error ? (
                <Failure error={p.error} />
              ) : (
                <>
                  <p>
                    HTTP {p.status} · {p.controls.length} visible controls
                  </p>
                  {p.screenshotUrl && (
                    <a href={p.screenshotUrl} target="_blank" rel="noreferrer">
                      <img
                        className="journey-map-image"
                        src={p.screenshotUrl}
                        alt={"Observed page " + p.url}
                      />
                    </a>
                  )}
                  {p.findings.map((f: any, i: number) => (
                    <p className="journey-finding" key={i}>
                      {f.message}
                    </p>
                  ))}
                </>
              )}
            </article>
          ))}
        </>
      )}
    </Page>
  );
}

export function Ontology() {
  const data = useQuery({
    queryKey: ["ontology"],
    queryFn: () => api("/ontology"),
  });
  const [text, setText] = useState("");
  const [error, setError] = useState<any>();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data.data) setText(JSON.stringify(data.data, null, 2));
  }, [data.data]);
  return (
    <Page
      title="Product ontology"
      description="Shared actors, entities, routes, and relationships in .traceback/ontology.json."
    >
      {data.isLoading ? (
        <p role="status">Reading ontology…</p>
      ) : data.error ? (
        <Failure error={data.error} retry={() => void data.refetch()} />
      ) : (
        <div className="journey-columns">
          <section>
            <h2>Actors</h2>
            {data.data.actors.map((a: any) => (
              <div className="journey-row" key={a.id}>
                <strong>{a.name}</strong>
                <code>{a.id}</code>
              </div>
            ))}
            <h2>Entities</h2>
            {!data.data.entities.length ? (
              <p>
                No product entities are defined yet. Add the concepts your
                journeys use.
              </p>
            ) : (
              data.data.entities.map((e: any) => (
                <div className="journey-row" key={e.id}>
                  <strong>{e.name}</strong>
                  <code>{e.id}</code>
                </div>
              ))
            )}
            <h2>Routes</h2>
            {!data.data.routes.length ? (
              <p>Discover source routes or import a completed browser map.</p>
            ) : (
              data.data.routes.map((r: any) => (
                <div className="journey-row" key={r.path}>
                  <code>{r.path}</code>
                  <span>
                    {r.observed ? "Observed" : "Static candidate"}
                    <small>{r.source}</small>
                  </span>
                </div>
              ))
            )}
            <h2>Relationships</h2>
            {!data.data.relations.length ? (
              <p>No relationships are defined.</p>
            ) : (
              data.data.relations.map((r: any, i: number) => (
                <p key={i}>
                  <code>{r.from}</code> {r.type} <code>{r.to}</code>
                </p>
              ))
            )}
          </section>
          <aside>
            <h2>Edit canonical ontology</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError(undefined);
                setNotice("");
                try {
                  await api("/ontology", "PUT", JSON.parse(text));
                  setNotice("Ontology saved.");
                  void data.refetch();
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Ontology JSON
                <textarea
                  className="journey-code"
                  rows={24}
                  spellCheck={false}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              {error && <Failure error={error} />}{" "}
              {notice && <p role="status">{notice}</p>}
              <button className="btn-precision btn-primary" disabled={busy}>
                Save ontology
              </button>
            </form>
          </aside>
        </div>
      )}
    </Page>
  );
}

function UXRow({ journey }: { journey: any }) {
  const data = useQuery({
    queryKey: ["journey-analysis", journey.id],
    queryFn: () => api("/" + journey.id + "/analysis"),
  });
  return (
    <article className="journey-run">
      <header>
        <Link href={"/journeys/" + journey.id}>{journey.name}</Link>
        <span>{data.data?.coverage || "Reading evidence…"}</span>
      </header>
      {data.error ? (
        <Failure error={data.error} />
      ) : data.isLoading ? (
        <p role="status">Loading observations…</p>
      ) : !data.data.runs.length ? (
        <p>No synthetic runs. UX findings remain unknown.</p>
      ) : (
        <>
          <p>
            {data.data.runs[0].persona} · {data.data.runs[0].status} · revision{" "}
            {data.data.runs[0].revision}
          </p>
          {data.data.runs[0].findings.map((f: any, i: number) => (
            <div key={i} className="journey-finding">
              <strong>{f.kind}</strong>
              <p>{f.message}</p>
            </div>
          ))}
          {!data.data.runs[0].findings.length && (
            <p>
              No rule-based friction candidates in this run. This does not
              establish a friction-free human experience.
            </p>
          )}
        </>
      )}
    </article>
  );
}
export function UXEvidence() {
  const data = useQuery({
    queryKey: ["canonical-journeys", ""],
    queryFn: () => api(""),
  });
  return (
    <Page
      title="UX evidence"
      description="Review synthetic friction candidates alongside the observed journey outcome."
    >
      <p className="journey-note">
        Real screenshots and action intervals support review. No satisfaction,
        conversion, or human completion metrics are inferred.
      </p>
      {data.isLoading ? (
        <p role="status">Reading journeys…</p>
      ) : data.error ? (
        <Failure error={data.error} retry={() => void data.refetch()} />
      ) : !data.data.items.length ? (
        <div className="v2-state">
          <h2>No journey evidence yet</h2>
          <Link href="/journeys/new" className="btn-precision btn-primary">
            Define a journey
          </Link>
        </div>
      ) : (
        data.data.items.map((j: any) => <UXRow key={j.id} journey={j} />)
      )}
    </Page>
  );
}
