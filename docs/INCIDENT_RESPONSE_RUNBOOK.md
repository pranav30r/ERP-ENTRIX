# ENTRIX ERP — Incident Response Runbook & Observability Standards

> **Classification**: Production Security & Reliability Operations Standard  
> **Audience**: On-Call DevOps Engineers, Security Incident Response Team, Lead Architects

---

## 1. Monitoring Metrics & Alert Threshold Proposals

These thresholds represent operational targets for production alerting:

| Metric | Warning Threshold | Critical Threshold | Action Triggered |
| :--- | :--- | :--- | :--- |
| **HTTP 5xx Error Rate** | > 1% over 5 mins | > 5% over 2 mins | Page On-Call Engineer, route to incident channel |
| **P95 Latency** | > 500 ms over 5 mins | > 1500 ms over 2 mins | Check DB slow query logs & pool saturation |
| **DB Connection Pool** | > 75% active connections | > 90% active connections | Trigger connection leak audit; scale pool size |
| **Failed Logins (Lockouts)**| > 20 lockouts / hour | > 100 lockouts / 10 mins | Investigate distributed credential stuffing attack |
| **Cross-Tenant Authorization** | Any HTTP 403 on tenant | > 5 failed attempts / min | Flag potential tenant escape attempt; inspect IP |
| **AI Inference Latency** | > 2000 ms over 3 mins | Circuit Breaker OPEN | Switch to Simple Moving Average (SMA) fallback |
| **Disk Capacity** | > 80% volume usage | > 90% volume usage | Purge expired logs, expand block storage volume |

---

## 2. Standard Operating Procedures for 7 Core Incident Scenarios

### Scenario 1: Complete Service Outage (HTTP 502 / 503 / Unresponsive)

1. **Verify Liveness & Readiness**:
   ```bash
   curl -I https://erp.yourdomain.com/health
   curl -I https://erp.yourdomain.com/ready
   ```
2. **Inspect Process State**:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   docker compose -f docker-compose.prod.yml logs --tail=100 server
   ```
3. **Action**: If process is hung on event loop starvation, issue container restart:
   ```bash
   docker compose -f docker-compose.prod.yml restart server
   ```

---

### Scenario 2: Database Failure or Connection Pool Saturation

1. **Symptom**: `/ready` returns HTTP 503 `{"checks": {"database": "DOWN"}}`.
2. **Diagnostics**:
   ```bash
   docker exec entrix-prod-postgres pg_isready -U postgres
   docker exec entrix-prod-postgres psql -U postgres -d entrix_erp -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
   ```
3. **Containment**: Terminate idle in-transaction connections:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < now() - INTERVAL '5 minutes';
   ```

---

### Scenario 3: Suspected Credential / Secret Compromise (JWT / DB / S3)

1. **Containment (Within 10 Minutes)**:
   - Rotate `JWT_SECRET` and `JWT_REFRESH_SECRET` in environment store immediately.
   - Restart backend instances (`docker compose -f docker-compose.prod.yml restart server`).
   - *Impact*: Invalidation of all existing active access and refresh tokens across all tenants; forces immediate re-authentication.
2. **Database Password Rotation**:
   - Issue `ALTER USER entrix_admin WITH PASSWORD '<NEW_SECRET>';` in PostgreSQL.
   - Update `DB_PASSWORD` in `.env` and restart application.
3. **Forensic Audit**: Run `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100;` to identify unauthorized actions.

---

### Scenario 4: Cross-Tenant Data Exposure Attempt

1. **Symptom**: Security log reports `Forbidden. Tenant context mismatch` or suspicious ID probing across tenants.
2. **Immediate Action**:
   - Identify offending User ID and IP address from request correlation ID (`X-Request-ID`).
   - Temporarily deactivate account:
     ```sql
     UPDATE users SET is_active = FALSE WHERE id = '<OFFENDING_USER_UUID>';
     ```
   - Invalidate all refresh tokens for that user:
     ```sql
     UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = '<OFFENDING_USER_UUID>';
     ```

---

### Scenario 5: Failed Deployment / Rollback Procedure

1. **Trigger**: Post-deployment smoke test fails, or HTTP 500 error spike within 10 minutes of release.
2. **Execute Rollback**:
   ```bash
   # Revert to previous release container tag
   docker compose -f docker-compose.prod.yml down
   docker compose -f docker-compose.prod.yml up -d
   ```
3. If migrations were applied that broke backward compatibility, restore database snapshot from pre-migration backup (`./deploy/scripts/restore.sh`).

---

### Scenario 6: Cryptographic Audit Trail or Ledger Corruption

1. **Detection**: `AuditService.verifyChainIntegrity()` returns `valid: false, broken_id: N`.
2. **Action**:
   - Retrieve broken log row and preceding log row:
     ```sql
     SELECT * FROM audit_logs WHERE id IN (N - 1, N);
     ```
   - Identify whether discrepancy was caused by direct database tampering or concurrent mutation collision.
   - Isolate affected tenant; notify Compliance and Lead Architect.

---

### Scenario 7: Python AI Microservice Failure or Timeout Spike

1. **Behavior**: Backend circuit breaker (`aiService.ts`) trips open automatically after consecutive timeouts (> 2,500ms).
2. **Graceful Degradation**:
   - Backend automatically switches to local Simple Moving Average (SMA) inventory forecasting.
   - Core ERP modules (Procurement, Requisitions, Double-Entry Accounting, Attendance) remain **100% operational**.
3. **Recovery**:
   ```bash
   docker compose -f docker-compose.prod.yml restart ai-service
   ```
   *Circuit breaker resets to closed state automatically upon first successful health probe.*
