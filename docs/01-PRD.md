# Product Requirements Document (PRD)
## ArchFlow — Interactive System Design & Architecture Simulation Platform

**Status:** Draft v1.0
**Owner:** Aryan, Naman, Aditya, Isha, Debojyoti
**Last updated:** 2026-08-09

---

## 1. Problem

People learning or teaching system design rely on static diagrams (boxes and arrows on a whiteboard or draw.io). Static diagrams can't answer the questions that actually matter:

- What happens when traffic doubles?
- Where does latency actually accumulate?
- What breaks first if this database goes down?
- Is this a single point of failure?

Understanding these things today requires either (a) real production experience, or (b) building and load-testing an actual system — both out of reach for students and junior engineers. The result is a cohort of engineers who can draw a "load balancer → service → database" diagram but can't reason about its runtime behavior.

## 2. Product Vision (the "one thing")

**Make system architecture visually understandable, not just visually drawable.**

Every other feature in this PRD is downstream of that one sentence. ArchFlow is not a diagramming tool that happens to simulate — it is a simulation tool that happens to look like a diagram. If a feature doesn't make the runtime behavior of an architecture easier to *see* and *feel*, it's out of scope for v1.

Concretely, "visually simple and showcase well" means:
- A request should be an animated particle/pulse traveling along the edges you drew, at a speed and color that reflect real latency/error state — not a number in a side panel you have to go read.
- A struggling component should visibly change color/shape (like a heatmap) — you should be able to glance at the canvas and know something is wrong before you read any chart.
- The metrics dashboard supplements the canvas; it never replaces it. If a user has to choose between watching the canvas or watching the dashboard, the canvas should already tell the story.

## 3. Target Users

| User | Need |
|---|---|
| CS students learning system design | Build intuition for tradeoffs (caching, replication, load balancing) without deploying real infra |
| Junior/mid engineers prepping for system design interviews | Practice designing + stress-testing common patterns (URL shortener, chat app, feed) |
| Instructors / bootcamps | A visual teaching aid to demonstrate failure modes and scaling live in class |

Non-goals for v1: production infra modeling for real cloud accounts, real network simulation, multi-tenant enterprise use.

## 4. Success Metrics (MVP)

- A user with zero backend experience can build a 4-node architecture (Client → LB → Service → DB), run a simulation, and correctly identify the bottleneck within 5 minutes, unaided.
- Simulation of 100 concurrent virtual requests renders smoothly (≥30fps) in-browser.
- A user can inject a failure (kill a node) and see cascading effects reflected on canvas within 1 simulation tick (<500ms perceived delay).
- AI recommendation returns actionable, graph-specific feedback (not generic text) for at least 5 canonical architecture patterns.

## 5. User Stories (MVP scope)

1. As a user, I can drag components (Client, Load Balancer, Service, Database, Cache, Message Queue) onto a canvas and connect them with directional edges.
2. As a user, I can configure basic parameters per component (e.g., service latency range, DB read/write latency, LB algorithm: round-robin/least-connections).
3. As a user, I can hit "Run Simulation" and watch animated requests flow through my architecture in real time.
4. As a user, I can see a live metrics dashboard (RPS, error rate, p50/p95 latency) while the simulation runs.
5. As a user, I can inject a failure into any node (kill it, add latency, throttle it) mid-simulation and observe the downstream effect visually and in metrics.
6. As a user, I can click "Analyze My Design" and get an AI-generated critique referencing my specific components (e.g., "Your database has no replica — this is a single point of failure").
7. As a user, I can register/log in and save my architecture, then reload it later.
8. As a user, I can see a component turn red/yellow/green based on simulated health (error rate / saturation), independent of reading the dashboard.

## 6. MVP Scope

### In scope
- Canvas editor: drag-drop, connect, delete, reposition, zoom/pan.
- Component library: Client, Load Balancer, API Gateway, Service, Cache, Database, Message Queue.
- Simulation engine: discrete-event or tick-based traversal of the graph producing per-edge latency, per-node load, and success/failure outcomes.
- Visual simulation layer: animated request particles, node color-coded health states, edge thickness/color reflecting traffic/latency.
- Metrics dashboard: RPS, error rate %, p50/p95/p99 latency, per-node load gauges.
- Failure injection: kill node, add latency to node, throttle node throughput, drop % of packets on an edge.
- AI advisory: single "Analyze" action producing a structured list of findings (severity, affected node(s), recommendation).
- Auth: JWT register/login.
- Persistence: save/load/list/delete projects (one user → many projects).

### Explicitly out of scope for MVP (see Future Scope)
- Kubernetes/pod-level simulation.
- Real cloud provider modeling (AWS/GCP/Azure specific behavior/pricing).
- Real-time multi-user collaboration.
- Cost estimation.
- Terraform/CloudFormation export.
- Deep security audits.

## 7. Key UX Principle: "Read the canvas, not the report"

Design constraint for every screen: a first-time viewer glancing at the canvas mid-simulation, with no dashboard visible, should be able to answer "is this system healthy right now, and if not, where's the problem?" This drives concrete UI decisions documented in `03-COMPONENT-SPEC.md` (color scale, animation semantics, node health states).

## 8. Risks

| Risk | Mitigation |
|---|---|
| Simulation engine complexity balloons (real queueing theory is hard) | Start with a simplified probabilistic model (see `02-ARCHITECTURE.md` §Simulation Model); iterate fidelity later |
| Canvas performance with many animated elements | Use canvas/WebGL rendering for particles (not DOM nodes) if React Flow + DOM proves too slow at target scale |
| AI responses feel generic/unhelpful | Constrain LLM with a structured graph schema + rule-based pre-checks (SPOF detection, missing cache, no retry) feeding the prompt, rather than relying on the LLM to infer everything |
| Scope creep toward "just another draw.io" | Enforce the "one thing" test in §2 on every proposed feature |

## 9. Open Questions
- Do we need multi-user collaboration in MVP demo (for the mini-project presentation), or is single-user sufficient? (Assumed: single-user for MVP, per team's own Future Scope.)
- Which LLM provider — Gemini vs OpenAI — finalize based on free-tier limits/latency (see `02-ARCHITECTURE.md`).
