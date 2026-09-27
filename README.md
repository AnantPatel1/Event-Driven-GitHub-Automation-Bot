# GitHub Automation Bot (Event-Driven Orchestration)

A production-grade, event-driven GitHub automation platform built with Next.js (App Router), TypeScript, PostgreSQL with Prisma ORM, Slack Webhooks, and Google Gemini 1.5 Flash AI Triage.

---

## 🏛️ Architecture Overview

```text
                               ┌──────────────────────────┐
                               │   GitHub Developer / UI  │
                               └────────────┬─────────────┘
                                            │ OAuth / Webhook
                                            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│              UNIFIED NEXT.JS FULL-STACK AUTOMATION PLATFORM (:3000)       │
│                                                                           │
│  [GET /api/auth/github] ──► [GET /api/auth/github/callback] ──► [Session] │
│                                                                           │
│  [POST /api/webhooks/github]                                              │
│       │                                                                   │
│       ▼                                                                   │
│  [HMAC-SHA256 Signature Verification (Raw Wire Buffer + timingSafeEqual)] │
│       │                                                                   │
│       ▼                                                                   │
│  [Idempotency Check: GitHubEvent.deliveryId UNIQUE]                       │
│       │ (202 Accepted immediately returned to GitHub <50ms)               │
│       ▼                                                                   │
│  [Async Event Processor Dispatcher via Next.js after()]                   │
│       │                                                                   │
│       ▼                                                                   │
│  [Configurable Rule Engine]                                               │
│    (contains, equals, starts_with on issue.*, pull_request.*)             │
│       │                                                                   │
│       ├───────────────────────┬────────────────────────┐                  │
│       ▼                       ▼                        ▼                  │
│  [GitHub REST API]      [Slack Webhook]          [Gemini AI Triage]       │
│  • Add Labels           • Operational alerts     • Severity (P0–P3)       │
│  • Post Comments        • Block cards            • Auto-summarization     │
│       │                       │                        │                  │
│       └───────────────────────┼────────────────────────┘                  │
│                               ▼                                           │
│                    [BotAction Audit Logs]                                 │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
                                ▼
               ┌───────────────────────────────────┐
               │       POSTGRESQL DATABASE         │
               │  • User (encrypted tokens)        │
               │  • Repository (webhook metadata)  │
               │  • Rule (triggers & conditions)   │
               │  • GitHubEvent (unique delivery)  │
               │  • BotAction (retry telemetry)    │
               │  • SlackIntegration (AES-256)     │
               └────────────────┬──────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                 REACT DASHBOARD & WEBHOOK SANDBOX UI                      │
│  • Live Service Health Telemetry                                          │
│  • Repositories Connection & Webhook Provisioning                         │
│  • Rule Engine Creator & Toggle Controls                                  │
│  • Slack Integrations Manager with Test Dispatch                          │
│  • Real-Time Event Stream & BotAction Execution Audit Logs                │
│  • Built-In Webhook Simulator for Instant Offline Verification            │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```text
Event-Driven-GitHub-Automation-Bot/
├── src/
│   ├── app/                      # Next.js App Router (UI & API Route Handlers)
│   │   ├── api/
│   │   │   ├── auth/             # GitHub OAuth & Session Endpoints (/dev-login, /github, /callback, /me, /logout)
│   │   │   ├── events/           # Webhook events and audit query endpoints
│   │   │   ├── health/           # System & database healthcheck endpoint
│   │   │   ├── integrations/     # Slack incoming webhook setup & testing
│   │   │   ├── repositories/     # Repository listing, connect, disconnect, webhook setup
│   │   │   ├── rules/            # Rule creation, toggle, and management
│   │   │   └── webhooks/
│   │   │       ├── github/       # GitHub HMAC verification & idempotent ingestion
│   │   │       └── simulate/     # In-browser offline webhook simulator
│   │   ├── dashboard/            # Protected Dashboard with tabbed views
│   │   ├── globals.css           # Global Tailwind CSS styles
│   │   ├── layout.tsx            # Root layout with fonts & AuthProvider
│   │   └── page.tsx              # Landing page with Quick Dev Login & GitHub OAuth
│   ├── components/               # React components (Dashboard tabs, modals, stats, pagination)
│   │   └── dashboard/            # RepositoriesTab, RulesTab, SlackTab, EventsAuditTab, WebhookSandboxTab
│   ├── context/                  # AuthContext & useAuth hook
│   ├── lib/
│   │   ├── api.ts                # Client-side API request helpers
│   │   └── server/               # Server-side business logic & services
│   │       ├── actionExecutor.ts # GitHub API & Slack dispatcher with exponential backoff
│   │       ├── encryption.ts     # AES-256-GCM encryption for sensitive Slack webhook URLs
│   │       ├── env.ts            # Validated environment variables (Zod)
│   │       ├── eventProcessor.ts # Asynchronous job runner via Next.js after()
│   │       ├── geminiTriage.ts   # Google Gemini 1.5 Flash automated issue triage
│   │       ├── github.ts         # GitHub REST client (repos, permissions, webhooks)
│   │       ├── prisma.ts         # Prisma client singleton
│   │       ├── ruleEngine.ts     # Flexible condition evaluator (contains, equals, starts_with)
│   │       ├── session.ts        # HMAC-SHA256 signed session cookie engine
│   │       └── slackValidation.ts# Slack webhook URL validator
│   └── types/                    # Unified TypeScript models, schemas, and DTOs
├── prisma/
│   └── schema.prisma             # Centralized PostgreSQL schema
├── docker-compose.yml            # PostgreSQL 16 container definition (Port 5433:5432)
├── .env.example                  # Documented environment variables template
├── .env                          # Local development environment configuration
├── README.md                     # Full system documentation
├── AI_NOTES.md                   # Engineering notes & technical retrospective
├── AGENTS.md                     # Architectural specifications & conventions
└── package.json                  # Next.js project configuration & scripts
```

---

## 🚀 Local Setup & Quickstart

### 1. Prerequisites
- **Node.js**: v20+ LTS (Tested on v24.16.0)
- **npm**
- **Docker & Docker Compose**: For local PostgreSQL database

### 2. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Description | Local Default / Production Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgrespassword@localhost:5433/github_bot?schema=public` |
| `NODE_ENV` | Runtime environment | `development` (or `production`) |
| `APP_URL` | Public application URL | `http://localhost:3000` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | From GitHub Developer Settings |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | From GitHub Developer Settings |
| `GITHUB_WEBHOOK_SECRET`| Shared secret for HMAC-SHA256 signature verification | E.g., `development_webhook_secret_key_32chars` |
| `SESSION_SECRET` | Secret key for signing session cookies | Random 32+ character string |
| `ENCRYPTION_KEY` | Secret key for AES-256-GCM encryption of Slack webhooks | Random 32+ character string |
| `GEMINI_API_KEY` | Google Gemini 1.5 Flash API key for AI triage (optional) | Free from [aistudio.google.com](https://aistudio.google.com) |
| `SLACK_WEBHOOK_URL` | Global default Slack incoming webhook URL (optional) | `https://hooks.slack.com/services/...` |

### 3. Launch Local PostgreSQL Database
```bash
docker compose up -d
```
> **Note**: Database is mapped to port `5433:5432` to avoid collisions with any existing local PostgreSQL instances.

### 4. Install Dependencies
```bash
npm install
```

### 5. Push Schema to Database
```bash
npm run db:push
```

### 6. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Both the web dashboard and all API route handlers run cohesively on port `3000`.

---

## 🌐 Local Webhook Testing with Public Tunnels

When receiving live incoming webhooks from GitHub to your local development machine:

### Option A: Cloudflare Tunnel (Recommended — No Account Required)
```bash
npx cloudflared tunnel --url http://localhost:3000
```
Copy the generated URL (e.g. `https://random-subdomain.trycloudflare.com`) and update `.env`:
```env
APP_URL=https://random-subdomain.trycloudflare.com
```

### Option B: ngrok
```bash
ngrok http 3000
```
Use the forwarded HTTPS URL in your GitHub Webhook configuration (`https://your-tunnel.ngrok-free.dev/api/webhooks/github`).

---

## 🛠️ Step-by-Step Evaluator End-to-End Walkthrough

1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Click **&ldquo;Quick Dev Login&rdquo;** for instant local access (or **&ldquo;Sign in with GitHub&rdquo;** if OAuth credentials are configured).
3. In the **Repositories** tab, click **Connect** on a repository (e.g., `project-a`).
4. In the **Automation Rules** tab, click **Create Rule**:
   - Event: `issues`
   - Condition: `issue.title` `contains` `bug`
   - Actions: `Add Label "bug"`, `Send Slack Notification`, and `Gemini AI Triage`
5. Optional: In the **Slack Integrations** tab, configure an incoming webhook URL and click **Test Dispatch**.
6. Switch to the **Webhook Sandbox** tab (or click **&ldquo;Simulate 'Bug' Webhook&rdquo;** in the header):
   - Select event type `issues` and click **Dispatch Webhook Simulation**.
   - The route handler immediately validates the HMAC signature.
   - The event is idempotently saved to PostgreSQL.
   - An immediate `202 Accepted` response returns in <50ms.
   - The background event processor matches the title, invokes Gemini 1.5 Flash triage, adds the GitHub label, and dispatches the Slack alert.
7. Navigate to the **Event & Action Audit Logs** tab:
   - Click on the event row to expand the **Downstream Bot Actions Audit Trail**.
   - Inspect the Gemini AI triage breakdown (summary, P0–P3 priority score, confidence), GitHub label execution, and Slack notification status with attempt counts and timestamps.
8. Re-dispatch the same simulation with an identical delivery ID to verify that database-level idempotency rejects the duplicate event.

---

## ☁️ Production Deployment

### Recommended Architecture:
- **Platform**: Vercel (Next.js App Router Full-Stack)
- **Database**: Neon Serverless PostgreSQL / Supabase / Railway

### Production Setup Checklist:
1. Create a serverless PostgreSQL database on [Neon.tech](https://neon.tech) and set `DATABASE_URL` in Vercel project environment variables.
2. In GitHub Developer Settings -> OAuth Apps:
   - Homepage URL: `https://your-app.vercel.app`
   - Authorization callback URL: `https://your-app.vercel.app/api/auth/github/callback`
3. Configure the following environment variables on Vercel:
   - `NODE_ENV=production`
   - `APP_URL=https://your-app.vercel.app`
   - `DATABASE_URL=postgresql://...`
   - `GITHUB_CLIENT_ID=...`
   - `GITHUB_CLIENT_SECRET=...`
   - `GITHUB_WEBHOOK_SECRET=...`
   - `SESSION_SECRET=...`
   - `ENCRYPTION_KEY=...`
   - `GEMINI_API_KEY=...` (optional)
   - `SLACK_WEBHOOK_URL=...` (optional)
4. Trigger deployment via Git push or Vercel CLI (`vercel --prod`).
