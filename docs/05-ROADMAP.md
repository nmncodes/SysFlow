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

## Suggested Team Split (5 members, adjust as needed)
- 2 on frontend canvas/editor (Phase 1, 3, 4 UI)
- 1 on backend simulation engine (Phase 2)
- 1 on backend auth/persistence/AI (Phase 5, 6 backend half)
- 1 floating/full-stack on dashboard + integration + polish (Phase 3 dashboard, Phase 7)

Re-pair as phases complete — this is a suggestion, not a rigid assignment.
