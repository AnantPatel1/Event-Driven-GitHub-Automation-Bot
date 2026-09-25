# GitHub Automation Bot (Event-Driven Orchestration)

A production-grade, event-driven GitHub automation platform built with Next.js App Router, Fastify (TypeScript), PostgreSQL with Prisma ORM, and Slack Webhooks.

---

## 🏛️ Architecture Overview

```text
                               ┌──────────────────────────┐
                               │   GitHub Developer / UI  │
                               └────────────┬─────────────┘
                                            │ OAuth / Webhook
                                            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    FASTIFY AUTOMATION ENGINE (:4000)                      │
│                                                                           │
│  [GET /auth/github] ──► [GET /auth/github/callback] ──► [Signed Session]  │
│                                                                           │
│  [POST /webhooks/github]                                                  │
│       │                                                                   │
│       ▼                                                                   │
│  [HMAC-SHA256 Signature Verification (timingSafeEqual)]                   │
│       │                                                                   │
│       ▼                                                                   │
│  [Idempotency Check: GitHubEvent.deliveryId UNIQUE]                       │
│       │ (202 Accepted immediately returned to GitHub)                     │
│       ▼                                                                   │
│  [Async Event Processor Dispatcher]                                       │
│       │                                                                   │
│       ▼                                                                   │
│  [Configurable Rule Engine]                                               │
│    (contains, equals, starts_with on issue.*, pull_request.*)             │
│       │                                                                   │
│       ├─────────────────────────────────┐                                 │
│       ▼                                 ▼                                 │
│  [GitHub REST API]             [Slack Incoming Webhook]                   │
│  • Add Labels (e.g., "bug")    • Formatted operational alert              │
│  • Post Comments               (Bounded exponential backoff retries)      │
│       │                                 │                                 │
│       └────────────────┬────────────────┘                                 │
│                        ▼                                                  │
│             [BotAction Audit Logs]                                        │
└────────────────────────┬──────────────────────────────────────────────────┘
                         │
                         ▼
        ┌───────────────────────────────────┐
        │       POSTGRESQL DATABASE         │
        │  • User (encrypted tokens)        │
        │  • Repository (webhook metadata)  │
        │  • Rule (triggers & conditions)   │
        │  • GitHubEvent (unique delivery)  │
        │  • BotAction (retry telemetry)    │
        └────────────────┬──────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS 15 DASHBOARD (:3000)                         │
│  • Live Service Health Telemetry                                          │
│  • Repositories Connection & Webhook Provisioning                         │
│  • Rule Engine Creator & Toggle Controls                                  │
│  • Real-Time Event Stream & BotAction Execution Audit Logs                │
│  • Built-In Webhook Simulator for Instant Offline Verification            │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```text
github-automation-bot/
├── apps/
│   ├── web/                    # Next.js 15 App Router Frontend (Port 3000)
│   │   ├── src/app/api/health/ # Frontend health diagnostic endpoint
│   │   ├── src/app/dashboard/  # Protected dashboard with tabs & simulator
│   │   └── src/context/        # AuthProvider & useAuth React context
│   └── server/                 # Fastify Node.js Automation API (Port 4000)
│       ├── src/config/env.ts   # Zod environment validation
│       ├── src/lib/github.ts   # GitHub API service
│       ├── src/lib/ruleEngine.ts # Condition matcher & rule engine
│       ├── src/lib/actionExecutor.ts # GitHub/Slack execution with exponential backoff
│       ├── src/lib/eventProcessor.ts # Asynchronous job runner
│       ├── src/plugins/auth.ts # Fastify session authentication plugin
│       └── src/routes/         # Webhooks, Auth, Repositories, Rules, Events, Health
├── packages/
│   └── shared/                 # Shared TypeScript models, DTOs & constants
├── prisma/
│   └── schema.prisma           # Centralized PostgreSQL schema
├── scripts/                    # Automated end-to-end and component test suites
├── docker-compose.yml          # PostgreSQL 16 container definition
├── .env.example                # Documented environment variables template
├── .env                        # Local development environment configuration
├── README.md                   # Full system documentation
├── AI_NOTES.md                 # Development notes, challenges & learnings
├── AGENTS.md                   # Agentic architectural specifications & conventions
└── package.json                # Monorepo workspaces root configuration
```

---

## 🚀 Local Setup & Quickstart

### 1. Prerequisites
- **Node.js**: v20+ LTS (Tested on v24.16.0)
- **npm** or **pnpm**
- **Docker & Docker Compose**: For local PostgreSQL database

### 2. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Description | Local Default / Production Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgrespassword@localhost:5433/github_bot?schema=public` |
| `PORT` | Backend Fastify HTTP Port | `4000` |
| `NODE_ENV` | Runtime environment | `development` (or `production`) |
| `FRONTEND_URL` | Frontend client origin for CORS | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Public API URL accessible from browser | `http://localhost:4000` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | From GitHub Developer Settings |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | From GitHub Developer Settings |
| `GITHUB_WEBHOOK_SECRET`| Shared secret for HMAC-SHA256 signature verification | E.g., `development_webhook_secret_key_32chars` |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL | `https://hooks.slack.com/services/...` |
| `SESSION_SECRET` | Secret key for signing session cookies | Random 32+ character string |

### 3. Launch Local PostgreSQL Database
```bash
docker compose up -d
```
> **Note**: Database is mapped to port `5433:5432` to avoid collisions with any existing local PostgreSQL instances.

### 4. Install Dependencies & Build Shared Library
```bash
npm install
npm run build:shared
```

### 5. Push Schema to Database
```bash
npm run db:push
```

### 6. Start Development Servers
Run both backend (`:4000`) and frontend (`:3000`) concurrently:
```bash
npm run dev
```

---

## 🧪 Automated Test Suites

Run the complete test suite across all subsystems:
```bash
npm run test
```

The test runner validates:
1. **GitHub OAuth & Sessions**: CSRF protection, httpOnly cookie generation, tamper detection, `/auth/me` token non-leakage, and logout revocation.
2. **Repository Connection & Authorization**: Permission verification, automatic webhook creation, multi-tenant isolation (User B cannot disconnect User A's repositories).
3. **Webhook HMAC-SHA256 Signatures**: Constant-time comparison, rejection of missing/invalid signatures, acceptance of valid signatures.
4. **Strict Idempotency**: Replaying the same `X-GitHub-Delivery` ID twice produces exactly 1 event and 0 duplicate actions.
5. **Rule Engine & Condition Matching**: Full regex and substring matching (`contains`, `equals`, `starts_with`).
6. **Action Execution & Exponential Backoff Retries**: Downstream GitHub labels and Slack notifications with bounded retry logic and audit logs in `BotAction`.

---

## 🌐 Local Webhook Testing with Public Tunnels

When testing live incoming webhooks from GitHub to `localhost`:

### Option A: Cloudflare Tunnel (Recommended — No Account Required)
```bash
npx cloudflared tunnel --url http://localhost:4000
```
Copy the generated URL (e.g. `https://random-subdomain.trycloudflare.com`) and update `.env`:
```env
NEXT_PUBLIC_API_URL=https://random-subdomain.trycloudflare.com
```

### Option B: ngrok
```bash
ngrok http 4000
```
Use the forwarded HTTPS URL in your GitHub Webhook configuration.

---

## 🛠️ Step-by-Step Evaluator End-to-End Walkthrough

1. Open `http://localhost:3000` in your browser.
2. Click **&ldquo;Quick Dev Login&rdquo;** (or **&ldquo;Sign in with GitHub&rdquo;** if OAuth keys are configured).
3. Open the **Dashboard**.
4. In the **Repositories** tab, click **Connect** on a repository (e.g. `project-a`).
5. In the **Automation Rules** tab, click **Create Rule**:
   - Event: `issues`
   - Condition: `issue.title` `contains` `bug`
   - Actions: `Add Label "bug"` and `Send Slack Notification`
6. Click the header button: **&ldquo;Simulate 'Bug' Webhook&rdquo;**:
   - The server receives the issue titled *"Bug: test GitHub automation"*.
   - Webhook signature is validated.
   - The event is idempotently persisted.
   - The rule engine matches the title.
   - Downstream actions execute (GitHub label added, Slack alert dispatched).
7. Navigate to the **Event & Action Audit Logs** tab:
   - Click on the event to expand the **Downstream Bot Actions Audit Trail**.
   - Observe both actions with `status: SUCCESS`, attempt count, and execution timestamps.
8. Click **&ldquo;Simulate 'Bug' Webhook&rdquo;** with an identical delivery ID to verify that idempotency strictly rejects the duplicate event.

---

## ☁️ Production Deployment

### Recommended Architecture:
- **Frontend**: Vercel (Next.js App Router)
- **Backend**: Render / Railway (Fastify Node.js Service)
- **Database**: Neon Serverless PostgreSQL

### Production Configuration Checklist:
1. Create a PostgreSQL database on [Neon.tech](https://neon.tech) and set `DATABASE_URL` in backend environment variables.
2. In GitHub Developer Settings -> OAuth Apps:
   - Homepage URL: `https://your-frontend.vercel.app`
   - Authorization callback URL: `https://your-backend.onrender.com/auth/github/callback`
3. In backend environment variables:
   - Set `NODE_ENV=production`
   - Set `FRONTEND_URL=https://your-frontend.vercel.app`
   - Set `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com`
   - Provide real `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, and `SLACK_WEBHOOK_URL`.
4. In frontend environment variables on Vercel:
   - Set `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com`.
