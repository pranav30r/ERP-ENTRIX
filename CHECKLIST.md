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
- [x] Disable production debug output and check exposed files

## 2. Legal and Privacy
- [x] Create a privacy policy reflecting actual data practices (`LEGAL.md`)
- [x] Create terms and conditions for the academic prototype (`LEGAL.md`)
- [x] Add cookie consent if non-essential cookies are used (Zero tracking/analytics cookies)
- [x] Minimize data collection and document deletion procedures (`LEGAL.md`)
- [x] Verify licenses for fonts, icons, and images (MIT / Lucide React / Tailwind)

## 3. UI/UX and SEO
- [x] Add page titles, descriptions, and social preview metadata (`index.html`)
- [x] Create favicon, robots.txt, and sitemap where appropriate (`favicon.svg`, `robots.txt`, `sitemap.xml`)
- [x] Add image alt text and optimize image sizes (Vector SVG branded assets)
- [x] Meet accessible color contrast and keyboard navigation requirements
- [x] Ensure responsive layouts and polished dashboard states (Stripe data density + Linear dark navigation)
- [x] Create a branded 404 page and fix broken links (`NotFound.tsx`)
- [x] Add client-side and server-side form validation (Zod schemas + React state guards)
- [x] Add appropriate spam protection to exposed forms (Rate limiter middleware)
- [x] Use privacy-friendly analytics only if needed and consented to where required (Zero external trackers)
- [x] Give each page a clear primary action (Action bars in Procurement, Inventory, Finance, AI Insights)

## 4. Testing and Delivery
- [x] Test complete ERP workflows and approval transitions (Procurement State Machine verified)
- [x] Test unauthorized access and invalid requests (Automated Jest suites passing)
- [x] Test database transactions and concurrent updates (ACID GRN testing passed)
- [x] Add unit, integration, and end-to-end tests (15 of 15 tests across 5 Jest suites passing)
- [x] Measure performance and review dependency vulnerabilities
- [x] Document setup, migrations, backups, and recovery (`README.md`, `backup.ps1`, `restore.ps1`, `initDb.ts`)
- [x] Verify local setup works without paid services (PostgreSQL 16 & Redis 7 running at ₹0)
- [x] Complete a security review before any public deployment
