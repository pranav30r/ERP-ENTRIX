# ENTRIX ERP — Phase 13: Monitoring, Observability & Incident Response Runbook

**Audience:** Site Reliability Engineers (SRE), On-Call DevOps & System Administrators  
**System:** ENTRIX ERP Production Candidate

---

## 1. Observability Architecture

### 1.1 Health Probes
- **Liveness Probe (`GET /health/live`):** Returns HTTP 200 `{"status": "ONLINE"}`. Verifies the Node.js event loop is responsive.
- **Readiness Probe (`GET /health/ready`):** Returns HTTP 200 `{"status": "READY", "checks": {"database": "UP"}}`. Executes a lightweight ping (`SELECT 1`) on the PostgreSQL connection pool. If database connectivity fails, returns HTTP 503.

### 1.2 Correlation ID & Structured Logging
- Every HTTP request receives or inherits `X-Request-ID` / `X-Correlation-ID`.
- Format:
  - Development: `[HTTP] POST /api/v1/auth/login 200 in 82ms [id: 9a3b984b]`
  - Production: JSON formatted (`level`, `timestamp`, `req_id`, `method`, `path`, `status`, `duration_ms`, `ip`).
- **Data Scrubbing:** Passwords, JWT secrets, refresh tokens, and credit card numbers are scrubbed from query logs and audit traces.

---

## 2. Critical Alert Thresholds

| Metric | Warning Threshold | Critical Incident Threshold | Immediate Response Action |
| :--- | :--- | :--- | :--- |
| **API Error Rate** | $> 2\%$ 5xx responses over 5m | $> 5\%$ 5xx responses over 5m | Page on-call; check container logs for unhandled exceptions. |
| **Database Pool Exhaustion** | $> 80\%$ connections in use | Connection timeouts / 503 on `/health/ready` | Check long-running queries (`pg_stat_activity`); restart or expand pool. |
| **Authentication Failures** | $> 10$ failed logins / minute | Account lockouts triggered (`HTTP 423`) | Inspect IP rate limits; investigate brute-force attempt. |
| **Double-Entry Imbalance** | Discrepancy $> ₹0.00$ detected | Non-zero ledger imbalance | Halt journal posting; engage Finance Lead. |
| **Cross-Tenant Context Mismatch** | $> 0$ occurrences of `SEC-ADV-01` | Any mismatch between header and token | Terminate compromised session; audit tenant activity. |

---

## 3. Incident Response Runbooks

### Runbook A: Application Outage (502 / 503 Errors)
1. Check process liveness: `docker ps` or `Get-Process node`.
2. Inspect last 100 log lines: `docker logs --tail 100 entrix-server`.
3. Check database probe: `curl http://localhost:5000/health/ready`.
4. If database is unreachable, execute Runbook B.
5. If Node.js crashed due to memory exhaustion, restart container: `docker restart entrix-server`.

### Runbook B: Database Outage / Connection Failures
1. Inspect PostgreSQL container: `docker logs --tail 50 entrix-postgres`.
2. Check disk space on host filesystem.
3. Test direct PostgreSQL socket connectivity:
   ```powershell
   docker exec -it entrix-postgres pg_isready -U postgres
   ```
4. If database corrupted or WAL exhausted, initiate Disaster Recovery restore from latest backup.

### Runbook C: Suspected Cross-Tenant Data Exposure
1. Immediately review `audit_logs` for suspicious queries across multiple `tenant_id` records.
2. Verify that JWT secret has not been leaked. If suspected, rotate `JWT_SECRET` immediately (invalidates all active user sessions).
3. Confirm that all endpoints enforce `requireTenant` and `getValidatedTenantId()`.
