# Technical Architecture — ArchFlow

## 1. System Overview

Three-tier architecture: React SPA (canvas + simulation rendering) ↔ Spring Boot REST API (auth, persistence, simulation orchestration, AI proxy) ↔ PostgreSQL.

```
[ Browser (React + TypeScript + React Flow) ]
        │  HTTPS/JSON (REST) + optional WebSocket for live sim ticks
[ Spring Boot API Gateway Layer ]
        │
   ┌────┼─────────────┬───────────────┐
   │                  │               │
[Auth Module]   [Simulation Engine]  [AI Advisory Module]
   │                  │               │  (calls Gemini API)
   └──────────────────┴───────────────┘
                  │
          [ PostgreSQL ]
```

**Key decision: where does the simulation run?**
The simulation *math* (latency accumulation, failure propagation, RPS calculation) runs on the **backend** (deterministic, testable, language-agnostic from frontend). The simulation *animation* (moving a dot along an SVG path at a given speed) runs on the **frontend**, driven by the tick data the backend produces. Backend never renders anything; frontend never invents numbers.

## 2. Frontend Architecture

- **Framework:** React + TypeScript, Vite for build tooling.
- **Diagramming:** React Flow — handles node/edge state, drag-drop, connections, viewport (zoom/pan).
- **Styling:** Tailwind CSS.
- **State management:** Zustand (or React Flow's built-in store + a thin app store) for canvas state; React Query for server state (projects, auth).
- **Simulation rendering layer:** a custom canvas overlay (HTML5 `<canvas>`, not DOM nodes) positioned over React Flow's viewport, responsible for:
  - Rendering animated particles along edge paths (position interpolated from tick data).
  - Rendering node health glow/color (derived from latest tick's per-node stats).
  - This is the layer that makes the product feel alive — see `03-COMPONENT-SPEC.md`.
- **Charts:** a lightweight charting lib (e.g. Recharts) for the metrics dashboard panel — supplementary, not primary.

### Why canvas overlay instead of animating React Flow's DOM nodes directly
At 50-100+ concurrent animated particles, DOM/CSS animation causes layout thrash and frame drops. A single `<canvas>` element redrawn via `requestAnimationFrame`, reading edge paths from React Flow's internal layout, scales far better. React Flow remains the source of truth for node/edge *positions*; the canvas overlay is purely a read-only visualization on top.

## 3. Backend Architecture (Spring Boot)

Modules (see `09-Project Modules` in the source doc, mapped to packages):

- `auth/` — registration, login, JWT issuance/validation, Spring Security filter chain.
- `project/` — CRUD for saved architectures (graph JSON blobs + metadata).
- `simulation/` — the simulation engine (see §4 below). Stateless per request; a simulation run is a pure function of (graph, config, injected failures) → time-series of ticks.
- `ai/` — builds a structured prompt from graph + simulation summary, calls Gemini API, parses response into structured findings. Includes a **pre-processing rules layer** (see below) so AI output is always grounded in real graph facts.
- `common/` — DTOs, graph schema validation, exception handling.

### Delivery of simulation ticks to the client
MVP: **synchronous batch mode** — client requests "run simulation for N seconds of simulated time," backend computes the full tick series (e.g., 200 ticks) and returns it in one response; frontend plays it back at real-time speed. This avoids WebSocket complexity for MVP while still feeling "live" to the user, since the frontend animates the returned time series.
Future scope: switch to WebSocket streaming for genuinely interactive/long-running or infinite simulations (needed once "network partition over time" / continuous chaos scenarios are added).

## 4. Simulation Model (the core hard problem)

Do **not** attempt full discrete-event queueing simulation for MVP — it's a semester of work on its own. Use a **tick-based probabilistic model**:

1. The graph is validated and topologically understood: identify entry nodes (Clients), and for each edge, direction of request flow.
2. Each component type has a small parameter set:
   - **Load Balancer:** algorithm (round-robin / least-connections / random), max throughput.
   - **Service:** base latency (ms, as a range/distribution), max concurrent capacity, failure rate under saturation.
   - **Database:** read latency, write latency, max connections, replica count (0 = SPOF).
   - **Cache:** hit rate %, hit latency, miss latency (falls through to next node).
   - **Message Queue:** max throughput, consumer lag behavior.
3. On "Run," the engine generates a request arrival stream (Poisson-ish, controlled by user-set target RPS) at each Client node.
4. For each simulated tick (e.g., 100ms of simulated time):
   - Requests advance along edges; each hop accumulates latency sampled from the target node's distribution.
   - If a node is over capacity for that tick, excess requests either queue (bounded queue) or fail (503-style), depending on config.
   - Injected failures (killed node, added latency, throttle, packet drop %) are applied as modifiers to the relevant node/edge for the ticks they're active.
5. Output per tick: per-node {load %, error count, avg latency}, per-edge {requests in flight, avg latency}, global {RPS, error rate, p50/p95/p99}.

This is intentionally a **simplified analytical/probabilistic model**, not a physically accurate network simulator — matches the "educational, visualize tradeoffs" goal in the PRD, and is tractable to build and to explain in a project report.

## 5. AI Advisory Module

Two-stage pipeline, not "dump the graph into an LLM and hope":

1. **Rule-based static analysis** (deterministic, in Java): detect known anti-patterns directly from the graph structure —
   - Single point of failure (any non-redundant node with >1 dependent and no replica/failover).
   - No cache in front of a DB receiving high read volume.
   - No load balancer in front of >1 service instance.
   - No timeout/retry/circuit breaker config on service-to-service edges.
   - Direct client-to-database connections (bypassing service layer).
2. **LLM synthesis:** the rule findings + simulation summary (bottleneck node, error rate, latency breakdown) are serialized into a structured prompt sent to Gemini. The LLM's job is only to **explain and prioritize** in natural language, not to invent facts — the facts are already computed. Response is parsed into `{severity, title, affectedNodeIds[], explanation, recommendation}[]`.

This keeps AI output grounded and directly tied to the user's specific graph (a stated MVP success metric in the PRD), and avoids hallucinated advice.

## 6. Data Flow Summary

1. User builds graph in React Flow → serialized to JSON (nodes, edges, per-node config).
2. "Run Simulation" → POST graph + sim config to `/api/simulations/run` → backend returns tick series.
3. Frontend plays back tick series on the canvas overlay + updates dashboard charts in sync.
4. "Analyze" → POST graph + last simulation summary to `/api/ai/analyze` → backend runs rules + calls Gemini → returns findings list → rendered as an annotated list + highlighted nodes on canvas.
5. "Save" → POST graph JSON + name to `/api/projects` → persisted in Postgres, tied to user id.

## 7. Deployment

- Docker Compose for local/dev: `frontend`, `backend`, `postgres` services.
- Backend exposes REST API on one port; frontend served separately (or via same origin behind a reverse proxy like Nginx in prod) to avoid CORS complexity in dev via Vite proxy.
- Environment-based config for JWT secret, Gemini API key (never in frontend — all AI calls proxied through backend).

## 8. Tech Stack Summary Table

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | React 18 + TypeScript + Vite | |
| Diagramming | React Flow | node/edge graph state + layout |
| Simulation rendering | HTML5 Canvas (custom) | particles + node health, overlaid on React Flow viewport |
| Charts | Recharts | metrics dashboard only |
| Styling | Tailwind CSS | |
| State | Zustand + React Query | canvas/local vs server state split |
| Backend | Spring Boot 3 (Java 21) | REST, modular by domain |
| Auth | Spring Security + JWT | stateless |
| DB | PostgreSQL | JSONB column for graph payloads + relational tables for users/projects |
| AI | Gemini API | via backend proxy only |
| Containerization | Docker + Docker Compose | |
