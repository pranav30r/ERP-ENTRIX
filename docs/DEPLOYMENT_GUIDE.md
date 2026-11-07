# ENTRIX ERP — Production Deployment & Operations Guide

> **Target Version**: ENTRIX ERP v1.0.0-PROD  
> **Classification**: Production Operational Standard Operating Procedure (SOP)

---

## 1. Infrastructure Prerequisites

| Component | Minimum Specification | Recommended Production |
| :--- | :--- | :--- |
| **Compute** | 2 vCPU, 4 GB RAM | 4 vCPU, 8 GB RAM (Dedicated Host / K8s Node) |
| **Operating System** | Ubuntu 22.04 LTS / Debian 12 | Enterprise Linux / Managed Container Runtime |
| **Container Engine** | Docker Engine 24.0+ & Compose v2 | Docker Engine 26+ / Kubernetes 1.28+ |
| **Database** | PostgreSQL 16.x (Isolated Container / RDS) | Managed PostgreSQL 16 (Multi-AZ, Point-in-Time Recovery) |
| **In-Memory Cache** | Redis 7.x (AOF persistence enabled) | Managed Redis Cluster / ElastiCache |
| **Reverse Proxy** | Nginx 1.25+ / Cloudflare / Traefik | Reverse Proxy with TLS 1.3 & HTTP/2 |
| **Storage** | 50 GB NVMe SSD | 150+ GB Scalable Block Storage |

---

## 2. Environment Variable Provisioning & Secret Configuration

Production secrets **must never** be committed to Git or embedded in container image layers. Populate `.env` or inject via AWS Secrets Manager / HashiCorp Vault.

### Production Environment Variables Template

```bash
# Core Environment
NODE_ENV=production
PORT=5000

# Client Origins & CORS (Comma-separated, no trailing slashes, NO WILDCARDS)
CLIENT_ORIGIN=https://erp.yourdomain.com
ALLOWED_ORIGINS=https://erp.yourdomain.com,https://admin.yourdomain.com

# PostgreSQL 16 Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=entrix_admin
DB_PASSWORD=<MANDATORY_STRONG_GENERATED_SECRET_MIN_32_CHARS>
DB_NAME=entrix_erp_prod

# Redis Cache
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<MANDATORY_STRONG_REDIS_SECRET>

# JWT Authentication (Cryptographically random, min 32 characters, no placeholders)
JWT_SECRET=<MANDATORY_STRONG_HEX_64_CHARACTERS>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<MANDATORY_STRONG_HEX_64_CHARACTERS>
JWT_REFRESH_EXPIRES_IN=7d

# Account Lockout Policy
LOCKOUT_MAX_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15

# Python AI Service
AI_SERVICE_URL=http://ai-service:8000
AI_INTERNAL_SECRET=<MANDATORY_SHARED_INTERNAL_SECRET>
```

### Safe Secret Generation Commands

```bash
# Generate 64-character cryptographically secure hex secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Database Creation & Migration Lifecycle

### Step 1: Pre-Migration Backup (Mandatory)

Always execute an isolated logical backup prior to running migrations in production:

```bash
# Linux / POSIX
./deploy/scripts/backup.sh

# Windows PowerShell
.\deploy\scripts\backup.ps1
```

### Step 2: Execute Controlled Migrations

Migrations must run in a single, controlled execution step prior to starting backend containers:

```bash
# Run migration container or task
docker compose -f docker-compose.prod.yml run --rm server npm run db:migrate
```

*The migration runner acquires atomic PostgreSQL advisory locks, records applied versions in `schema_migrations`, and operates without destructive drops.*

---

## 4. Application Startup & Container Orchestration

Deploy using the hardened production Docker Compose profile:

```bash
# Build and launch production services in detached mode
docker compose -f docker-compose.prod.yml up -d --build
```

### Process Architecture

```
[ Internet ]
      │
      ▼ (Port 443 / TLS 1.3)
[ Reverse Proxy / Nginx ]
      ├───> /api/  ──────> [ entrix-prod-server:5000 ] (Internal Network)
      │                            │
      │                            ├───> [ entrix-prod-postgres:5432 ]
      │                            ├───> [ entrix-prod-redis:6379 ]
      │                            └───> [ entrix-prod-ai:8000 ]
      │
      └───> /      ──────> [ entrix-prod-client:80 ] (React SPA Bundle)
```

---

## 5. Health Verification & Smoke Tests

Verify liveness and deep dependency readiness immediately following deployment:

```bash
# 1. Liveness Probe (HTTP 200 required)
curl -fsS http://localhost:5000/health

# 2. Readiness Probe (Checks PostgreSQL pool, Redis, and AI microservice)
curl -fsS http://localhost:5000/ready
```

### Expected Response

```json
{
  "status": "READY",
  "checks": {
    "database": "UP",
    "redis": "UP",
    "ai_service": "UP"
  },
  "uptime_seconds": 18,
  "timestamp": "2026-10-26T01:15:48.000Z"
}
```

---

## 6. Rollback & Recovery Procedures

If health probes fail or unexpected regressions are detected:

1. **Stop Application Containers**:
   ```bash
   docker compose -f docker-compose.prod.yml down
   ```
2. **Restore Previous Database State**:
   ```bash
   ./deploy/scripts/restore.sh ./deploy/backups/entrix_erp_backup_<TIMESTAMP>.sql
   ```
3. **Re-deploy Previous Verified Image Tag**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```
