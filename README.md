# SysFlow (ArchFlow)

**Interactive System Design & Architecture Simulation Platform**

Turn system architecture from a static diagram into a living simulation. Drag components onto a canvas, wire them up, run traffic through them, inject failures, and get AI-driven feedback — all visually, at a glance.

> The core idea: **make architecture visually understandable, not just drawable.** See [`docs/01-PRD.md`](docs/01-PRD.md) for the full product vision.

## Team

Aryan · Naman · Aditya · Isha · Debojyoti

## Docs

| Doc | What's in it |
|---|---|
| [docs/01-PRD.md](docs/01-PRD.md) | Problem, vision, scope, success metrics |
| [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) | System design, simulation model, AI pipeline |
| [docs/03-COMPONENT-SPEC.md](docs/03-COMPONENT-SPEC.md) | Visual design spec — colors, animation, UX rules |
| [docs/04-DATA-MODEL-AND-API.md](docs/04-DATA-MODEL-AND-API.md) | DB schema + REST API contract |
| [docs/05-ROADMAP.md](docs/05-ROADMAP.md) | Phased build plan + team split |
| [docs/06-WIREFRAMES.md](docs/06-WIREFRAMES.md) | Screen layouts (ASCII wireframes) |
| [docs/07-TESTING-STRATEGY.md](docs/07-TESTING-STRATEGY.md) | What's unit tested vs. manually verified |
| [SETUP.md](SETUP.md) | Local dev environment setup |

## Tech Stack

- **Frontend:** React + TypeScript + Vite, React Flow, Tailwind CSS, Rechart
- **Backend:** Spring Boot 3 (Java 21), Spring Security + JWT
- **Database:** PostgreSQL
- **AI:** Gemini API (proxied through backend)
- **Infra:** Docker + Docker Compose

## Status

Planning complete (docs above). Implementation not yet started — see [docs/05-ROADMAP.md](docs/05-ROADMAP.md) for phase breakdown.

## License

MIT — see [LICENSE](LICENSE).
