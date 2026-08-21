# Build Roadmap — ArchFlow

Phased so there's a demoable product early and often. Each phase ends in something you can show, not just code that compiles.

## Phase 0 — Setup (few days)
- Repo scaffolding: `frontend/` (Vite + React + TS), `backend/` (Spring Boot), `docker-compose.yml` with Postgres.
- CI skeleton (build + lint) optional but recommended for a team of 5.
- Agree on graph JSON schema (locked from `04-DATA-MODEL-AND-API.md`) so frontend/backend can build in parallel.

## Phase 1 — Static Editor (canvas without simulation)
- React Flow canvas: drag components from a sidebar palette, connect nodes, delete, reposition, zoom/pan.
- Node inline config side panel.
- Component library visuals per `03-COMPONENT-SPEC.md` §6.
- **Demo checkpoint:** can build a diagram and it looks good — but nothing runs yet.

## Phase 2 — Simulation Engine (backend-only, no visuals yet)
- Implement tick-based model from `02-ARCHITECTURE.md` §4 as a standalone, unit-testable Java module.
- `/api/simulations/run` endpoint returns tick series for a hardcoded/sample graph.
- **Demo checkpoint:** Postman/curl call returns believable tick data for a 4-node graph.

## Phase 3 — Bring the Canvas to Life
- Canvas overlay (HTML5 canvas) rendering particles + node health colors driven by tick playback.
- Run/Pause/Reset/speed controls.
- Metrics dashboard panel (Recharts) wired to the same tick data.
- **Demo checkpoint:** this is the "wow" moment — build a diagram, hit Run, watch it breathe.

## Phase 4 — Failure Injection
- Context menu actions (kill/latency/throttle/packet-drop) that feed into `injectedFailures` config.
- Visual failure badges + red "down" state.
- **Demo checkpoint:** kill the DB, watch requests fail and the canvas turn red downstream.

## Phase 5 — AI Advisory
- Rule-based static analysis module (SPOF detection, missing cache, no LB, etc.).
- Gemini API integration behind backend proxy; prompt construction from rules + sim summary.
- Findings panel + canvas highlight overlay.
- **Demo checkpoint:** click Analyze, get specific callouts tied to your actual graph.

## Phase 6 — Auth + Persistence
- JWT register/login, project CRUD, save/load.
- Starter templates (per `03-COMPONENT-SPEC.md` §7) seeded as read-only example projects.
- **Demo checkpoint:** full user journey — register, build, simulate, save, log out, log back in, reload.

## Phase 7 — Polish for Presentation
- Empty-state onboarding, starter templates, responsive layout pass, error states, loading states.
- Write up the project report using these docs as source material.

## Phase 8 — Deployment & Hardening ✅ Done
- Live at `sys-flow-green.vercel.app` (frontend) + `sysflow-backend.onrender.com` (backend) + Neon Postgres.
- `render.yaml` Blueprint for one-click backend deploys; CI (`.github/workflows/ci.yml`) runs `mvn test` +
  frontend build/lint on every push.
- Rate-limited AI/SRS/pricing/interview endpoints, 10MB upload cap, Gemini fallback to rule-based findings
  on failure, health endpoint, `CORS_ALLOWED_ORIGINS` configurable per environment.
- **Demo checkpoint:** open the live Vercel URL cold, build something, hit Analyze — round-trips through
  Render + Neon + Gemini for real.

## Phase 9 — Collaboration & Sharing ✅ Done
- Public read-only share links for a saved project (no login required to view/replay a simulation).
- Export diagram as PNG/JSON (PDF optional stretch).
- Versioning: every save snapshots the prior graph (`project_versions` table); last 10 kept per project,
  oldest pruned automatically. "History" button in the editor toolbar lists snapshots by timestamp and
  restores one in place — restoring itself snapshots the pre-restore state, so a restore is undoable too.
- Multi-user live co-editing is out of scope here — too large for this timeline; revisit only if Phase 8-9 land early.
- **Demo checkpoint:** share a link, a logged-out visitor watches the same simulation replay. Save a
  project a few times, open History, restore an older version, confirm it round-trips.

## Phase 10 — SRS Import & Trade-off Advisor ✅ Done
Turn a written spec into a starting diagram, then critique it — closing the loop from "requirements doc" to "simulated architecture" to "here's what to change and why."

- Upload a PDF/DOCX/TXT SRS (`dev.sysflow.srs`, PDFBox/POI text extraction); Gemini extracts nodes/edges
  constrained to the full 30-type component set, plus stated `replicaCount`/capacity/cache-hit-rate
  requirements where the document explicitly ties them to a named component.
- Auto-layout (layered, left-to-right by dependency depth) onto the canvas.
- Unmapped tech terms surface in an amber banner instead of being silently dropped.
- Runs through the same RuleEngine + Gemini trade-off pipeline as the Analyze button.
- Importing into a non-empty canvas shows a diff (components added/removed) before replacing anything.
- **Demo checkpoint:** upload a sample SRS, get a diagram + tech-specific trade-off callouts, then simulate it.

## Phase 11 — Trade-off Depth, Community, and Market Features ✅ Done
Extends the Phase 5/10 advisory loop from "what's wrong" to "what to do instead," and adds features aimed
at broader adoption beyond the core simulate-and-critique loop.

- **Swap-and-compare:** right-click any node → "Compare alternative…" → pick a different component type →
  runs two real simulations (current vs. swap, same target load/failures held constant) and shows p95
  latency, error rate, throughput, bottleneck load, SPOF count, and cost side by side, with an Apply button.
- **Cost-aware findings:** Gemini's recommendations cite a rough monthly cost figure where informative
  (e.g. "add a replica for roughly $60/mo"), backed by a shared `CostModel`.
- **Real cloud pricing:** `/api/pricing/estimate` uses Azure's public Retail Prices API for a verified
  subset of component types (generic compute, managed databases, cache, object storage — each mapped to a
  real, live-discovered SKU); everything else stays on the illustrative model, explicitly tagged
  `source: "real"` vs `"illustrative"` per node so a guess is never presented as verified pricing.
- **Infrastructure-as-Code export:** Export → `docker-compose.yml` generates a starter compose file — real
  images for infra components, `build:` stubs for your own app code, `depends_on` from the actual edges,
  and honest comments for anything that isn't a single container (CDN, DNS, third-party APIs, etc.).
- **Public template gallery:** opt-in publish/unpublish per project (`My Projects` → Publish); `/gallery`
  lists published architectures with author and component count; opening one loads a fresh, unowned copy.
- **System-design interview practice mode:** 6 well-known prompts (URL shortener, distributed rate
  limiter, news feed, chat app, video streaming, e-commerce checkout) at `/interview`; submit a design for
  AI grading against a 4-part rubric (Scalability, Reliability, Component Appropriateness, Trade-off
  Awareness), grounded in the same RuleEngine facts and specific to the actual submitted graph.
- **Mobile editor fixes:** touch drag-and-drop didn't work at all (HTML5 DnD doesn't fire on most mobile
  browsers) — added tap-to-add; the Palette/ConfigPanel/FindingsPanel sidebars squeezed the canvas to a
  sliver below 768px — now full-width bottom sheets with a backdrop.
- **Not built — deliberately deferred:** real-time multiplayer co-editing. Needs dedicated WebSocket +
  conflict-resolution infrastructure that doesn't fit safely into an incremental pass; revisit as its own
  scoped effort if there's a real need for it.
- **Demo checkpoint:** compare two alternatives for a node and see the diff; publish a project and find it
  in the gallery from a logged-out session; grade a design against an interview prompt and get specific
  feedback tied to the actual graph.

## Suggested Team Split (5 members, adjust as needed)
- 2 on frontend canvas/editor (Phase 1, 3, 4 UI)
- 1 on backend simulation engine (Phase 2)
- 1 on backend auth/persistence/AI (Phase 5, 6 backend half)
- 1 floating/full-stack on dashboard + integration + polish (Phase 3 dashboard, Phase 7)

Re-pair as phases complete — this is a suggestion, not a rigid assignment.
