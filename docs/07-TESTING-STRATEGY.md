# Testing Strategy — ArchFlow

Kept intentionally lean — this is a mini-project with a 5-person team, not a production system. Effort is concentrated where correctness actually matters and where bugs are hardest to spot by eye.

## 1. What gets real automated tests

| Area | Why | Type |
|---|---|---|
| Simulation engine (tick math, latency accumulation, failure propagation) | Wrong numbers are invisible until someone spots a weird demo result — and this is the module the whole product's credibility rests on | Unit tests (JUnit), pure functions, deterministic given a seeded RNG |
| Rule-based AI pre-analysis (SPOF detection, missing-cache detection, etc.) | Deterministic logic, easy to test, and wrong findings undermine user trust immediately | Unit tests (JUnit) with fixture graphs |
| Graph JSON schema validation | Prevents malformed graphs from ever reaching the simulation engine | Unit tests on validator |
| Auth (JWT issuance/validation, password hashing) | Security-relevant | Unit + integration tests (Spring Boot Test) |
| REST API contracts (projects CRUD, simulation run, auth endpoints) | Prevents frontend/backend drift | Integration tests (Spring Boot `@SpringBootTest` + Testcontainers for Postgres, or H2 for speed) |

## 2. What's manually verified / demo-checked, not automated

| Area | Why manual is enough here |
|---|---|
| Canvas drag-and-drop, node connection UX | High effort to automate (e2e), low risk of silent regression, easy to eyeball each PR |
| Particle animation speed/color correctness | Visual/subjective — verified by watching it during each phase's demo checkpoint (see `05-ROADMAP.md`) |
| AI-generated natural language quality | Can't meaningfully unit test LLM prose; spot-check against the 5 canonical patterns listed in the PRD success metrics |
| Responsive layout / cross-browser | Manual pass in Phase 7 (polish), Chrome + one other browser is sufficient for a mini-project |

## 3. Test Data

Maintain a small set of fixture graphs under `backend/src/test/resources/fixtures/` covering:
- Simple healthy 3-tier app (Client → LB → Service → DB)
- Graph with an intentional SPOF (single DB, no replica)
- Graph with a missing cache in front of a high-read DB
- Graph designed to saturate a service (to test failure-rate-under-load logic)

These fixtures double as the "starter templates" referenced in `03-COMPONENT-SPEC.md` §7 and `06-WIREFRAMES.md` §6 — build them once, use them in both tests and product.

## 4. Definition of Done (per phase)

A phase in `05-ROADMAP.md` isn't done until:
1. Its demo checkpoint works live, unscripted, in front of the team.
2. Any new backend logic touching simulation/rules/auth has unit tests passing.
3. No console errors in the browser during the demo flow.

## 5. Out of scope

Load/performance testing of the platform itself (how many concurrent *users* ArchFlow can serve), formal security audit, and accessibility (a11y) compliance testing are not planned for this iteration — noted here so it's a conscious decision, not an oversight.
