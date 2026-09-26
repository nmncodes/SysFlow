# Data Model & API Contract — ArchFlow

## 1. Database Schema (PostgreSQL)

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(200) NOT NULL,
    description   TEXT,
    graph_json    JSONB NOT NULL,       -- nodes, edges, per-node config
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE simulation_runs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    config_json    JSONB NOT NULL,      -- target RPS, duration, injected failures
    result_summary JSONB,               -- aggregate stats (kept; full tick series not persisted in MVP)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`graph_json` shape (frontend ⇄ backend contract):

```json
{
  "nodes": [
    {
      "id": "n1",
      "type": "loadBalancer",
      "position": { "x": 120, "y": 80 },
      "config": { "algorithm": "round-robin", "maxThroughput": 500 }
    }
  ],
  "edges": [
    { "id": "e1", "source": "client1", "target": "n1" }
  ]
}
```

## 2. REST API Endpoints (MVP)

### Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, password, displayName}` | Returns JWT |
| POST | `/api/auth/login` | `{email, password}` | Returns JWT |

### Projects
| Method | Path | Notes |
|---|---|---|
| GET | `/api/projects` | List current user's projects (metadata only) |
| GET | `/api/projects/{id}` | Full project incl. `graph_json` |
| POST | `/api/projects` | Create; body = `{name, description, graphJson}` |
| PUT | `/api/projects/{id}` | Update graph/name |
| DELETE | `/api/projects/{id}` | Delete |

### Simulation
| Method | Path | Notes |
|---|---|---|
| POST | `/api/simulations/run` | Body: `{graphJson, config: {targetRps, durationSeconds, injectedFailures[]}}`. Returns `{ticks: [...], summary: {...}}` |

`injectedFailures` example: `[{type: "kill", nodeId: "n3", fromTick: 20}, {type: "latency", nodeId: "n2", extraMs: 300, fromTick: 0, toTick: 50}]`

Tick object shape:
```json
{
  "t": 12,
  "nodes": { "n1": { "loadPct": 42, "errorRate": 0.0, "avgLatencyMs": 18 } },
  "edges": { "e1": { "inFlight": 6, "avgLatencyMs": 22 } },
  "global": { "rps": 480, "errorRatePct": 0.4, "p50": 20, "p95": 55, "p99": 90 }
}
```

### AI Advisory
| Method | Path | Notes |
|---|---|---|
| POST | `/api/ai/analyze` | Body: `{graphJson, lastSimulationSummary}`. Returns `{findings: [{severity, title, affectedNodeIds[], explanation, recommendation}]}` |

## 3. Auth Notes
- JWT in `Authorization: Bearer <token>` header.
- Stateless — no server session store needed for MVP; token expiry ~24h with client-side redirect to login on 401.
