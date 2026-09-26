# Visual Design Spec — Making Architecture "Readable at a Glance"

This doc exists because the core product bet (per the PRD) is that **the canvas itself must communicate system health**, not just topology. This is the spec for exactly how.

## 1. Node Visual States

Every node has a single derived `health` state per simulation tick, computed from load% and error rate. Rendered as a colored ring/glow around the node icon (not a full color swap of the icon — keep the icon recognizable).

| State | Trigger | Color | Motion |
|---|---|---|---|
| Idle | No simulation running | Neutral gray outline | Static |
| Healthy | load < 60% capacity, error rate < 1% | Green | Static, subtle idle pulse |
| Under load | load 60–85%, error rate < 5% | Yellow/amber | Faster pulse |
| Critical | load > 85% or error rate ≥ 5% | Orange | Rapid pulse + slight shake |
| Down / Failed | node killed (failure injection) or error rate ≥ majority | Red, icon dimmed/greyed | Static (dead), red "X" badge |

Color scale is intentionally traffic-light-based (green/amber/red) — universally understood, no legend required for a first-time viewer.

## 2. Edge Visual Encoding

- **Thickness:** proportional to current requests-in-flight on that edge (thin = idle, thick = high traffic). Capped at a max visual thickness to avoid overlap chaos.
- **Color:** gradient from blue (fast/healthy) → amber → red based on the edge's current average latency relative to a configurable "acceptable" threshold for that connection type.
- **Animated particles:** small dots travel along the edge path from source to target. Particle speed is inversely proportional to latency (slow-moving dot = high latency — this is the single most important visual metaphor in the product, since it lets a user *feel* latency without reading a number). Particle color = red if that specific request failed (e.g., timed out, hit a dead node), green/blue if succeeded.
- **Failed requests:** rendered as a particle that visibly stops short and fades/breaks near the point of failure, rather than disappearing instantly — reinforces cause visibility.

## 3. Dashboard Panel (Supplementary, not primary)

Docked side panel, collapsible. Shows for the whole system and per selected node:
- RPS (line chart, rolling window)
- Error rate % (line chart)
- p50/p95/p99 latency (line chart or sparkline set)
- Per-node load gauge (small radial gauge, mirrors the node's canvas color)

Rule: nothing in this panel should be the *only* place a piece of information is visible. If a fact matters, it must also be representable on the canvas (color, animation, badge). The dashboard is for trends over time; the canvas is for "right now."

## 4. Failure Injection UI

- Right-click a node → context menu: "Kill Node," "Add Latency (+Xms)," "Throttle (limit to X%)," toggle back to healthy.
- Right-click an edge → "Drop X% of packets."
- Active injected failures shown as a small badge/icon on the node/edge (e.g., a lightning bolt icon) so it's clear an effect is user-caused vs. emergent from load.

## 5. AI Findings Overlay

When "Analyze" returns findings:
- Each finding highlights its affected node(s) with a dashed outline in a severity color (purple = info, orange = warning, red = critical) distinct from the health-state colors, to avoid confusion between "currently failing" and "AI flagged this as a design risk."
- Findings list appears in a side panel: severity icon, title, one-line explanation, recommendation. Clicking a finding pans/zooms the canvas to the relevant node(s).

## 6. Component Library (MVP set)

| Component | Icon concept | Key configurable params |
|---|---|---|
| Client | Simple user/browser icon | Target RPS to generate |
| Load Balancer | Diamond/hub icon | Algorithm (round-robin, least-connections, random) |
| API Gateway | Shield/gate icon | Rate limit (req/s) |
| Service | Hexagon/box icon | Base latency range, max concurrency, failure rate at saturation |
| Cache | Lightning/flash icon | Hit rate %, hit latency, miss latency |
| Database | Cylinder icon | Read latency, write latency, max connections, replica count |
| Message Queue | Parallel lines/queue icon | Max throughput, consumer count |

## 7. Interaction Principles

- **No modal-heavy config:** node parameters edit inline via a slide-out panel when a node is selected, never a blocking modal — keeps the canvas visible at all times.
- **Simulation controls always visible:** a persistent bottom/top bar with Run / Pause / Reset / speed slider (0.5x–4x playback of the returned tick series), regardless of scroll/zoom state.
- **Zero-state guidance:** empty canvas shows a faint "drag a component here to start" hint plus 2-3 one-click starter templates (e.g., "Basic 3-tier app," "Cached read-heavy API") so a new user has something to run within 10 seconds.
