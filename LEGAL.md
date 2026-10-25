# ENTRIX ERP — Terms of Use & Privacy Statement
**Classification**: Academic Research & Engineering Prototype  
**Institution**: Ramdeobaba University, Nagpur (B.Tech CSE 2026–27)

---

## 1. Terms of Use
1. **Academic Demonstration**: ENTRIX is an educational software engineering prototype developed strictly for evaluation, research, and non-commercial academic demonstration.
2. **Access Control**: Demonstration accounts (`admin@entrix.local`) are provisioned exclusively for university evaluation boards.
3. **Warranty Disclaimer**: The software is provided "AS IS", without warranties of any kind regarding merchantability or fitness for enterprise accounting compliance.

---

## 2. Privacy & Data Practices
1. **Zero Third-Party Telemetry**: ENTRIX runs on a self-contained zero-cost stack (PostgreSQL, Redis, local FastAPI ML). No user telemetry or transaction payloads are transmitted to external commercial LLM APIs or advertisers.
2. **Password Security**: All user credentials are cryptographically hashed using bcrypt with an adaptive cost factor of 10. Plain text passwords are never persisted.
3. **Immutable Audit Governance**: System state changes are recorded with SHA-256 hash chains for educational integrity verification.
