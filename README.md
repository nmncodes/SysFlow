<div align="center">

# SysFlow

**Interactive System Design & Architecture Simulation Platform**

Turn system architecture from a static diagram into a living simulation — build it, run real traffic through it, break it on purpose, and get AI-driven feedback, all visually, at a glance.

[Live Demo](#quick-start) · [Docs](#documentation) · [Roadmap](docs/05-ROADMAP.md)

</div>

---

## What is SysFlow?

Most system design tools stop at drawing boxes and arrows. SysFlow treats an architecture diagram as a **running simulation**:

- **Build** — drag Load Balancers, Services, Caches, Databases, and Message Queues onto a canvas and wire them together.
- **Simulate** — hit Run and watch animated request traffic flow through your design in real time. Particle speed and color reflect real latency, not a number you have to go read.
- **Break it** — kill a node, throttle a service, or drop packets on an edge, and watch the failure cascade visually.
- **Improve** — get AI-generated, graph-specific feedback (single points of failure, missing caches, unprotected databases) before they cost you.

> The guiding principle behind every design decision: **make architecture visually understandable, not just drawable.** See [`docs/01-PRD.md`](docs/01-PRD.md) for the full product vision.

## Quick Start

**Prerequisites:** Node.js 20+, Java 21 (JDK), Maven (or use the wrapper once added), and optionally Docker.

```bash
# 1. Backend — simulation engine + API
cd backend
mvn spring-boot:run
# → http://localhost:8080

# 2. Frontend — landing page + editor
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Open `http://localhost:5173` for the landing page, then **Open Editor** to build and simulate an architecture. See [`SETUP.md`](SETUP.md) for environment variables and Docker Compose usage.

## Project Status

Actively in development. Phases below track [`docs/05-ROADMAP.md`](docs/05-ROADMAP.md):

| Phase | Status | What it covers |
|---|---|---|
| 0 — Setup | ✅ Done | Repo scaffolding, frontend/backend skeletons, Docker Compose |
| 1 — Static Editor | ✅ Done | Drag-and-drop canvas, component palette, inline config panel |
| 2 — Simulation Engine | ✅ Done | Tick-based request propagation, capacity/latency modeling, SPOF detection (unit tested) |
| 3 — Live Canvas | ✅ Done | Animated particle edges, live node health colors, real-time metrics from the engine |
| 4 — Failure Injection | ⏳ Next | Kill/throttle/latency/packet-drop controls |
| 5 — AI Advisory | ⏳ Planned | Rule-based analysis + Gemini-generated recommendations |
| 6 — Auth + Persistence | ⏳ Planned | JWT auth, save/load projects (PostgreSQL) |
| 7 — Polish | ⏳ Planned | Onboarding, starter templates, responsive pass |

## How It Works

```
┌────────────────────────┐        ┌──────────────────────────┐
│   React + React Flow    │  HTTP  │   Spring Boot API         │
│   canvas editor          │───────▶│   /api/simulations/run    │
│   (drag/drop, config)   │        │   tick-based sim engine   │
└────────────────────────┘        └──────────────────────────┘
           ▲                                    │
           │        tick series (RPS,           │
           └────── latency, errors, SPOFs) ◀────┘
```

You design the graph in the browser; the backend runs a simplified probabilistic simulation (not a full network stack) over it and returns a time series the frontend plays back as live animation. Full breakdown in [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md).

## Repository Structure

```
frontend/    React + TypeScript + Vite — landing page & simulation editor
backend/     Spring Boot — simulation engine, REST API, (soon) auth & AI
docs/        Product & engineering docs — see below
```

## Documentation

| Doc | What's in it |
|---|---|
| [docs/01-PRD.md](docs/01-PRD.md) | Problem, vision, scope, success metrics |
| [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) | System design, simulation model, AI pipeline |
| [docs/03-COMPONENT-SPEC.md](docs/03-COMPONENT-SPEC.md) | Visual design spec — colors, animation, UX rules |
| [docs/04-DATA-MODEL-AND-API.md](docs/04-DATA-MODEL-AND-API.md) | DB schema + REST API contract |
| [docs/05-ROADMAP.md](docs/05-ROADMAP.md) | Phased build plan + team split |
| [docs/06-WIREFRAMES.md](docs/06-WIREFRAMES.md) | Screen layouts (ASCII wireframes) |
| [docs/07-TESTING-STRATEGY.md](docs/07-TESTING-STRATEGY.md) | What's unit tested vs. manually verified |
| [SETUP.md](SETUP.md) | Local dev environment setup, env vars, Docker |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Flow, Tailwind CSS |
| Backend | Spring Boot 3, Java 21 |
| Simulation | Custom tick-based engine (see [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md)) |
| Database | PostgreSQL *(landing in Phase 6)* |
| Auth | Spring Security + JWT *(landing in Phase 6)* |
| AI | Gemini API, proxied through the backend *(landing in Phase 5)* |
| Infra | Docker + Docker Compose |

## Testing

```bash
cd backend
mvn test
```

Simulation engine correctness is covered by unit tests for healthy, saturated, SPOF, and failure-injection scenarios. See [`docs/07-TESTING-STRATEGY.md`](docs/07-TESTING-STRATEGY.md) for what's automated vs. manually verified.

## Team

Aryan · Naman · Aditya · Isha · Debojyoti

## License

MIT — see [LICENSE](LICENSE).
