# Wireframes — ArchFlow

Rough ASCII layouts to remove ambiguity before Phase 1 starts. These are structural (what's where), not visual polish — see `03-COMPONENT-SPEC.md` for the actual look/feel (colors, animation).

## 1. Main Editor Screen

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Logo   Project Name [editable]              Save  Share  [User] ▾       │
├───────────┬───────────────────────────────────────────────┬─────────────┤
│           │                                                │             │
│ COMPONENT │                                                │  METRICS    │
│ PALETTE   │                                                │  PANEL      │
│           │                CANVAS                          │ (collapsible)│
│ [Client]  │      (React Flow + canvas overlay)             │             │
│ [LB]      │                                                │  RPS  ▁▂▃▅  │
│ [Gateway] │        [Client]──▶[LB]──▶[Service]──▶[DB]      │  Err% ▁▁▂▁  │
│ [Service] │                              │                 │  p95  ▁▃▂▁  │
│ [Cache]   │                              ▼                 │             │
│ [DB]      │                           [Cache]               │  Per-node   │
│ [Queue]   │                                                │  load       │
│           │                                                │  gauges     │
│           │  (drag from palette, connect by dragging       │             │
│           │   from node edge to node edge)                 │             │
├───────────┴───────────────────────────────────────────────┴─────────────┤
│  ▶ Run   ⏸ Pause   ⟲ Reset     Speed: [0.5x 1x 2x 4x]     🤖 Analyze     │
└─────────────────────────────────────────────────────────────────────────┘
```

Notes:
- Left palette: fixed width, scrollable list of component icons + label, drag-and-drop onto canvas.
- Right panel: collapsible (toggle button), defaults open on desktop, closed on small screens.
- Bottom bar: always visible regardless of scroll/zoom — this is the primary control surface, per `03-COMPONENT-SPEC.md` §7.

## 2. Node Selected — Inline Config (slide-out, not modal)

```
┌───────────────────────────────────────────┬─────────────┐
│                                            │ ⚙ Service    │
│              CANVAS                       │ ────────────│
│         [Service] ◀── selected            │ Name:        │
│                                            │ [checkout-svc]│
│                                            │              │
│                                            │ Base latency:│
│                                            │ [20]-[80] ms │
│                                            │              │
│                                            │ Max capacity:│
│                                            │ [500] req/s  │
│                                            │              │
│                                            │ Failure rate │
│                                            │ at saturation│
│                                            │ [5] %        │
│                                            │              │
│                                            │  [Delete]    │
└───────────────────────────────────────────┴─────────────┘
```

Slides in from the right, overlapping (not replacing) the metrics panel space when both would be open — metrics panel auto-collapses when a node config panel is open, and vice versa.

## 3. Failure Injection Context Menu

```
        right-click on a node
        ┌───────────────────────┐
        │ ⚡ Kill Node            │
        │ ⏱  Add Latency (+ms)   │
        │ 🐢 Throttle (limit %)  │
        │ ✅ Restore to Healthy  │
        └───────────────────────┘
```

## 4. AI Findings Panel (after clicking "Analyze")

```
┌─────────────────────────────┐
│ 🤖 Design Findings (3)       │
├─────────────────────────────┤
│ 🔴 Critical                  │
│ Single Point of Failure      │
│ Your database has no replica.│
│ If it fails, checkout-svc    │
│ has no fallback.              │
│ → Add a read replica          │
│   [View on canvas]            │
├─────────────────────────────┤
│ 🟠 Warning                    │
│ No cache before high-read DB  │
│ → Add a Cache component       │
│   [View on canvas]            │
├─────────────────────────────┤
│ 🟣 Info                       │
│ No rate limiting at gateway   │
│   [View on canvas]            │
└─────────────────────────────┘
```

Clicking "View on canvas" pans/zooms to the affected node(s) and applies the dashed severity-colored outline described in `03-COMPONENT-SPEC.md` §5.

## 5. Auth Screens (minimal — not the focus of the product)

```
┌──────────────────────┐        ┌──────────────────────┐
│      Log In          │        │      Register        │
│ Email    [________]  │        │ Name     [________]  │
│ Password [________]  │        │ Email    [________]  │
│ [ Log In ]            │        │ Password [________]  │
│ No account? Register  │        │ [ Create Account ]   │
└──────────────────────┘        └──────────────────────┘
```

## 6. Projects Dashboard (post-login landing page)

```
┌─────────────────────────────────────────────────────────┐
│  My Projects                          [+ New Project]    │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐│
│  │ Basic 3-Tier  │  │ Chat App      │  │ URL Shortener ││
│  │ [thumbnail]   │  │ [thumbnail]   │  │ [thumbnail]   ││
│  │ Edited 2d ago │  │ Edited today  │  │ Template       ││
│  └───────────────┘  └───────────────┘  └───────────────┘│
└─────────────────────────────────────────────────────────┘
```

Starter templates (per `03-COMPONENT-SPEC.md` §7) appear here as read-only cards a user can "Use as starting point" to clone into their own project.
