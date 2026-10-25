# ENTRIX ERP — Project Quality, Security & Delivery Checklist

## 1. Security and Authentication
- [x] Keep secrets out of frontend code and Git (enforced via `.env.example` and `.gitignore`)
- [x] Validate environment variables and configure `.gitignore`
- [x] Secure login, sessions, and password hashing (bcrypt with 10 salt rounds, signed JWTs)
- [x] Enforce backend RBAC for every protected operation (`requireRole` middleware)
- [x] Validate API schemas and prevent injection/XSS (Sequelize parameterized queries, Zod)
- [x] Configure rate limiting, CORS, and security headers (Helmet.js, CORS whitelist, express-rate-limit)
- [x] Secure PostgreSQL and audit dependencies (PostgreSQL isolated in Docker, npm audit checked)
- [x] Review Git history for leaked secrets (Clean git log, zero credentials committed)
- [ ] Disable production debug output and check exposed files

## 2. Legal and Privacy
- [ ] Create a privacy policy reflecting actual data practices
- [ ] Create terms and conditions for the academic prototype
- [ ] Add cookie consent if non-essential cookies are used
- [ ] Minimize data collection and document deletion procedures
- [ ] Verify licenses for fonts, icons, and images (MIT / Lucide React / Tailwind)

## 3. UI/UX and SEO
- [ ] Add page titles, descriptions, and social preview metadata
- [ ] Create favicon, robots.txt, and sitemap where appropriate
- [ ] Add image alt text and optimize image sizes
- [ ] Meet accessible color contrast and keyboard navigation requirements
- [ ] Ensure responsive layouts and polished dashboard states
- [ ] Create a branded 404 page and fix broken links
- [ ] Add client-side and server-side form validation
- [ ] Add appropriate spam protection to exposed forms
- [ ] Use privacy-friendly analytics only if needed and consented to where required
- [ ] Give each page a clear primary action

## 4. Testing and Delivery
- [ ] Test complete ERP workflows and approval transitions (Procurement State Machine)
- [x] Test unauthorized access and invalid requests (Automated Jest suites passing)
- [ ] Test database transactions and concurrent updates (ACID GRN testing)
- [x] Add unit, integration, and end-to-end tests (Jest configured and passing)
- [ ] Measure performance and review dependency vulnerabilities
- [x] Document setup, migrations, backups, and recovery (Documented in README.md & DDL)
- [x] Verify local setup works without paid services (PostgreSQL 16 & Redis 7 running at ₹0)
- [ ] Complete a security review before any public deployment
