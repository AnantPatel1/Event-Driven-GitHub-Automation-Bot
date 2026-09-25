# AI_NOTES.md — Development & Engineering Log

## 1. AI Tools & Models Used
- **Model**: Gemini 3.8 Flash (High) via Antigravity Agentic IDE
- **Role**: Senior Full-Stack Engineer / Pair Programmer

---

## 2. Work Performed by AI
- **Phase 1 (Monorepo & Database)**:
  - Designed and initialized workspaces monorepo (`packages/shared`, `apps/server`, `apps/web`) supporting both npm and pnpm.
  - Authored full centralized Prisma schema with models: `User`, `Repository`, `Rule`, `GitHubEvent`, `BotAction`.
  - Configured PostgreSQL 16 container in `docker-compose.yml` with port isolation (`5433:5432`).
  - Added health diagnostics endpoints (`/health` and `/api/health`).
- **Phase 2 (GitHub OAuth & Secure Sessions)**:
  - Implemented GitHub OAuth authorization flow (`GET /auth/github`, `GET /auth/github/callback`).
  - Generated cryptographically secure random `oauth_state` tokens with signed httpOnly cookies to prevent OAuth CSRF attacks.
  - Built Fastify authentication decorator (`fastify.authenticate`) and session cookie engine signed with `SESSION_SECRET`.
  - Implemented `/auth/me` ensuring zero access token leakage and `/auth/logout`.
- **Phase 3 (Repository Connection & Authorization)**:
  - Built `GitHubService` covering repository discovery, admin permission verification, and automated webhook creation/deletion for `issues` and `pull_request`.
  - Built `GET /repositories`, `POST /repositories/:id/connect`, and `DELETE /repositories/:id/disconnect` with strict multi-tenant ownership verification.
- **Phases 4 & 5 (Webhook Ingestion & Idempotency)**:
  - Implemented `POST /webhooks/github` with raw byte buffer capture for HMAC SHA-256 constant-time verification (`crypto.timingSafeEqual`).
  - Enforced strict database idempotency using `GitHubEvent.deliveryId UNIQUE`, safely handling replayed and concurrent duplicate deliveries.
- **Phases 6, 7 & 8 (Rule Engine, Actions & Slack Notifications)**:
  - Built configurable Rule Engine supporting operators (`contains`, `equals`, `starts_with`) on nested payload fields (`issue.title`, `issue.body`, `pull_request.*`).
  - Implemented GitHub REST API actions (`github.add_label`, `github.comment`).
  - Implemented formatted Slack Incoming Webhook cards with operational summaries.
  - Implemented bounded exponential backoff retries (1s, 5s) and persisted audit logs in `BotAction`.
- **Phases 9 & 10 (Interactive Protected Dashboard & Simulator)**:
  - Built responsive Next.js 15 App Router dashboard with Tab navigation: Repositories, Rules Manager, and Event Telemetry.
  - Added built-in Webhook Simulator (`POST /webhooks/simulate`) to test rule triggers and actions live from the browser without needing a public tunnel.
- **Phases 11-13 (Testing, Deployment & Documentation)**:
  - Created 63 automated tests covering auth, sessions, repository authorization, HMAC verification, idempotency, rule matching, and action execution.
  - Documented complete architecture, tunnel instructions, and production setup in `README.md`.

---

## 3. Work Done Manually / Human-in-the-Loop
- Approved workspace directory and container orchestration setup.
- Evaluated phase progress and verified commands.
- Monitored live dev server executions (`pnpm dev`).

---

## 4. Key Architectural Decisions
1. **Isolated PostgreSQL Port (5433)**: During initial inspection, port 5432 was already occupied by an existing local service (`litellm_db`). To eliminate port collision and ensure an isolated clean database environment, the docker-compose service was configured to map container port 5432 to host port 5433.
2. **Workspaces Monorepo**: Using native workspaces allows shared domain models (`@github-bot/shared`) to be consumed by both backend and frontend without publishing packages or maintaining brittle relative path imports.
3. **Decoupled Fastify Health Check**: Fastify's `/health` endpoint executes `SELECT 1` via Prisma to actively verify live database connectivity rather than merely reporting process uptime.
4. **Multi-Tenant Authorization Barriers**: Repositories and webhook operations are strictly isolated per user (`userId_githubRepositoryId` compound uniqueness). Every mutation verifies that the repository belongs to the requesting user before performing any database or GitHub API changes.
5. **Decoupled Ingestion & Background Processing**: Webhooks acknowledge receipt immediately with `202 Accepted` after HMAC verification and database persistence, offloading slow external calls (GitHub API / Slack) to an asynchronous dispatcher.

---

## 5. The Hardest Bug or Incorrect Suggestion from AI
The most subtle bug occurred in **HMAC-SHA256 signature verification**:
Initial implementation attempts relied on re-stringifying the parsed JSON body (`JSON.stringify(request.body)`) to calculate the HMAC digest. However, GitHub computes the signature over the raw, unparsed byte stream. JavaScript's `JSON.stringify` does not preserve the original formatting, key order, or whitespace differences present in GitHub's original payload, causing HMAC verification to intermittently fail on legitimate webhooks.

Additionally, in sequential test runs, previous test rules persisted in the database across runs, causing simulated events to match multiple duplicate rules and fire duplicate actions during the assertion check (`expected 2 actions, received 4`).

---

## 6. How the Problem Was Discovered
- The HMAC issue was discovered when testing cryptographic signature verification against GitHub payloads containing whitespace, where `verifySignature` returned `false` on valid signatures.
- The rule persistence issue was caught by the automated test suite in `scripts/test_engine.ts` via the assertion failure:
  `❌ FAIL: Both downstream actions (GitHub label + Slack) recorded (AssertionError: expected 2, got 4)`.

---

## 7. How It Was Fixed
- **HMAC Wire Buffer Fix**: Fastify was configured with a custom content type parser for `application/json` using `{ parseAs: 'buffer' }`. This captures the exact raw `Buffer` from the wire into `request.rawBody` before parsing JSON. The HMAC digest is computed directly against `request.rawBody`, guaranteeing 100% cryptographic parity with GitHub's signature.
- **Test Scoping Fix**: Added an explicit cleanup step (`await prisma.rule.deleteMany({ where: { repositoryId: testRepo.id } })`) in `scripts/test_engine.ts` before creating test rules, ensuring test runs are completely deterministic and idempotent.

---

## 8. What to Improve with More Time
1. **Redis / BullMQ Queue**: Transition the in-process `EventProcessor` to a persistent Redis/BullMQ queue for multi-instance horizontal scaling and distributed dead-letter queue management.
2. **Webhook Replay UI**: Allow users to replay past failed webhooks directly from the dashboard event logs with a single click.
3. **Condition Expression Builder**: Extend the rule engine to support compound boolean expressions (`(A AND B) OR C`) and regex pattern matching.
4. **OpenTelemetry Telemetry**: Add distributed trace contexts across webhook receipt, rule evaluation, and Slack notification delivery.
