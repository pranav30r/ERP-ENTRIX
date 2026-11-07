# ENTRIX ERP — Phase 13: Staging & Pilot Deployment Runbook

**Document Purpose:** Step-by-step reproducible deployment procedure for ENTRIX ERP Release Candidate (v1.0.0-rc1).  
**Hosting Model:** Containerized Local/Staging Environment (Docker Compose + Node.js 20 LTS + PostgreSQL 16).

---

## 1. Prerequisites & Host System Verification

Before initiating deployment, verify:
- Host OS: Windows 11 / Linux (Ubuntu 22.04+) with Docker Engine 24.x+ and Docker Compose v2.x.
- Node.js Runtime: v20.x LTS with npm v10.x.
- Network Ports:
  - `5434`: PostgreSQL Database
  - `6379`: Redis Cache / Rate Limiter
  - `5000`: Backend REST API Service
  - `5173`: Frontend Client Service (or Port `80` if NGINX containerized)

---

## 2. Environment Configuration

1. Clone or checkout the release candidate branch.
2. Generate production configuration from `.env.example`:
   ```powershell
   Copy-Item .env.example .env
   ```
3. Set mandatory production variables in `.env`:
   - `NODE_ENV=production`
   - `JWT_SECRET`: Generate a 64-character random hex string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`: Configure explicit database credentials (never use default `postgres/postgres` in production).
   - `ALLOW_MOCK_BILLING=true` (Required for pilot sandbox; if set to `false`, live Stripe webhook signature verification is strictly enforced).

---

## 3. Database Initialization & Migration Execution

Execute sequential schema migrations within atomic transactions:

```powershell
# 1. Start Database & Redis dependencies
docker compose up -d postgres redis

# 2. Wait for database readiness
npm --prefix server test tests/phase4_quality_performance.test.ts -- -t "readiness probe"

# 3. Apply schema migrations (001 through 008)
npm --prefix server run db:migrate
```

*Expected Output:*
```
[MIGRATION] Migration tracker initialized.
[MIGRATION] Applied: 001_initial_schema.sql
...
[MIGRATION] Applied: 008_phase11_enterprise_indexes.sql
[MIGRATION] Successfully executed 8 migration(s).
```

---

## 4. Application Build & Container Execution

### Option A: Direct Node.js Production Run
```powershell
# 1. Build TypeScript Services
npm --prefix server run build
npm --prefix client run build

# 2. Launch Backend Service
$env:NODE_ENV="production"
npm --prefix server start

# 3. Serve Frontend Client
npm --prefix client run preview -- --port 5173 --host
```

### Option B: Docker Compose Full Stack Run
```powershell
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 5. Post-Deployment Smoke Verification

Run the automated smoke test script against the deployed environment:
```powershell
npm --prefix server test tests/e2e_smoke.test.ts
```

Verify endpoints:
- `GET http://localhost:5000/health`: HTTP 200 `{"status": "ONLINE"}`
- `GET http://localhost:5000/health/ready`: HTTP 200 `{"status": "READY", "checks": {"database": "UP"}}`
- Navigate to `http://localhost:5173`: Verify login screen renders with 0 console errors.
