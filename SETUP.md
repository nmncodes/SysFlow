# Local Development Setup

## Prerequisites
- Node.js 20+ and npm
- Java 21 (JDK)
- Docker + Docker Compose
- Git

## Environment Variables

Create a `.env` file at the repo root (never commit this — it's gitignored). Use `.env.example` as the template once it's added in Phase 0.

| Variable | Used by | Description |
|---|---|---|
| `POSTGRES_DB` | docker-compose | Database name (e.g. `archflow`) |
| `POSTGRES_USER` | docker-compose | DB user |
| `POSTGRES_PASSWORD` | docker-compose | DB password |
| `SPRING_DATASOURCE_URL` | backend | e.g. `jdbc:postgresql://localhost:5432/archflow` |
| `JWT_SECRET` | backend | Random 256-bit secret for signing JWTs — generate with `openssl rand -base64 32` |
| `JWT_EXPIRATION_MS` | backend | Token lifetime, e.g. `86400000` (24h) |
| `GEMINI_API_KEY` | backend | Gemini API key — **backend only, never exposed to frontend** |
| `VITE_API_BASE_URL` | frontend | e.g. `http://localhost:8080/api` |

## Running Everything via Docker Compose (once Phase 0 lands)

```bash
docker compose up --build
```

This will bring up:
- `postgres` on `5432`
- `backend` (Spring Boot) on `8080`
- `frontend` (Vite dev server or built static assets) on `5173` / `80`

## Running Services Individually (for active development)

**Backend:**
```bash
cd backend
./mvnw spring-boot:run
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Database only (for local backend dev against Docker Postgres):**
```bash
docker compose up postgres
```

## Common Issues
- **CORS errors in dev:** use Vite's dev proxy (configured in `vite.config.ts`) to forward `/api/*` to the backend instead of hitting `localhost:8080` directly from the browser.
- **JWT errors after restarting backend:** if `JWT_SECRET` changes, all previously issued tokens become invalid — clients need to log in again.
- **Gemini API quota/rate limits:** the AI advisory module should fail gracefully (return rule-based findings only) if the Gemini call fails — see `docs/02-ARCHITECTURE.md` §5.
