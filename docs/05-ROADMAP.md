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

## Phase 8 — Deployment & Hardening
- Containerize frontend + backend; deploy (e.g. Render/Railway for backend, Vercel/Netlify for frontend, Neon for Postgres).
- CI pipeline: build + lint + `mvn test` on every PR, block merge on failure.
- Harden the AI proxy endpoint: rate-limiting, request size caps, timeout/fallback to rule-based-only on Gemini failure (already partially in place — verify).
- Basic observability: structured backend logs, a health-check endpoint, minimal frontend error reporting.
- **Demo checkpoint:** a public URL that survives a cold start and a burst of concurrent simulations.

## Phase 9 — Collaboration & Sharing ✅ Done
- Public read-only share links for a saved project (no login required to view/replay a simulation).
- Export diagram as PNG/JSON (PDF optional stretch).
- Versioning: every save snapshots the prior graph (`project_versions` table); last 10 kept per project,
  oldest pruned automatically. "History" button in the editor toolbar lists snapshots by timestamp and
  restores one in place — restoring itself snapshots the pre-restore state, so a restore is undoable too.
- Multi-user live co-editing is out of scope here — too large for this timeline; revisit only if Phase 8-9 land early.
- **Demo checkpoint:** share a link, a logged-out visitor watches the same simulation replay. Save a
  project a few times, open History, restore an older version, confirm it round-trips.

## Phase 10 — SRS Import & Trade-off Advisor
Turn a written spec into a starting diagram, then critique it — closing the loop from "requirements doc" to "simulated architecture" to "here's what to change and why."

- **Upload & parse:** accept PDF/DOCX/plain-text SRS upload; backend extracts raw text (Apache PDFBox / POI or similar — no OCR needed for typed docs).
- **Structured extraction:** send extracted text to Gemini with a schema-constrained prompt to pull out: named components/actors, stated tech choices (e.g. "MySQL", "Redis", "S3"), and described data flows between them.
- **Map to the component palette:** resolve free-text tech mentions to the existing 17-component set (e.g. "MySQL"/"Postgres" → Database, "Redis" → Cache) with a confidence score; anything unmapped surfaces as an "unrecognized — placed as generic Service" node rather than silently dropped.
- **Auto-layout:** lay the extracted graph onto the canvas (reuse React Flow's existing node/edge model — no new rendering path) using a simple layered/dagre-style layout.
- **Trade-off advisory:** run the Phase 5 rule engine against the generated graph as-is, then have Gemini rewrite each finding in terms of the user's *actual stated choice* — "You specified a single MySQL instance for writes; under load this is a single point of failure — a read replica or managed HA setup would remove it" — same findings-panel + canvas-highlight UX already built in Phase 5, extended to reference the source tech name.
- **Review/edit before simulating:** user can drag/fix the auto-generated graph before hitting Run, since extraction won't be perfect.
- **Demo checkpoint:** upload a sample SRS, watch it become an editable diagram with tech-specific trade-off callouts, then simulate it.

## Suggested Team Split (5 members, adjust as needed)
- 2 on frontend canvas/editor (Phase 1, 3, 4 UI)
- 1 on backend simulation engine (Phase 2)
- 1 on backend auth/persistence/AI (Phase 5, 6 backend half)
- 1 floating/full-stack on dashboard + integration + polish (Phase 3 dashboard, Phase 7)

Re-pair as phases complete — this is a suggestion, not a rigid assignment.
