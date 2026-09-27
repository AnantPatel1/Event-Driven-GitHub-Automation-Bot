# AGENTS.md — Agent Guidelines & Architecture Manual

## Overview
This repository implements an event-driven GitHub Automation Bot that connects to GitHub repositories, verifies and ingests webhooks idempotently, evaluates configurable rules, and executes downstream actions (GitHub API labels/comments + Slack notifications + Google Gemini AI triage).

## Project Layout (Unified Next.js Full-Stack)
- `src/app`: Next.js 16 App Router UI pages & API route handlers (`/api/auth/*`, `/api/webhooks/*`, `/api/rules/*`, etc.) on Port 3000
- `src/components`: React dashboard tabs, modals, stats, and telemetry UI
- `src/lib/server`: Backend business logic, GitHub client, action executor, event processor, and Gemini AI triage
- `src/types`: Unified TypeScript types, schemas, and DTOs
- `prisma/schema.prisma`: Centralized PostgreSQL database schema
- `docker-compose.yml`: Local PostgreSQL 16 container on port 5433

## Architecture & Engineering Decisions
1. **Unified Next.js Architecture**: All API route handlers and dashboard UI run cohesively within a single Next.js 16 application, eliminating dual-port conflicts, CORS overhead, and cross-origin cookie syncing issues.
2. **Raw Wire Body Ingestion**: Webhook route handler consumes `await request.text()` before JSON parsing, ensuring raw byte preservation for HMAC-SHA256 signature verification.
3. **Idempotency by Design**: Webhook deduplication is strictly enforced at the database level via `GitHubEvent.deliveryId UNIQUE`. In-memory Sets are avoided as they fail across worker restarts and serverless instances.
4. **Decoupled Ingestion & Processing**: The webhook endpoint responds `202 Accepted` immediately (<50ms) after signature verification and persistence. Slow external operations (GitHub API, Slack webhook, Gemini AI triage) run asynchronously via Next.js 16 `after()`.
5. **Port Mapping**: PostgreSQL is mapped to port `5433:5432` to avoid collisions with existing local PostgreSQL instances on port 5432.

## Security Conventions
- **Zero Secret Leakage**: Secrets (`GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `SLACK_WEBHOOK_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`) must never be prefixed with `NEXT_PUBLIC_` or sent to the browser.
- **Constant-Time Comparison**: Webhook signatures (`X-Hub-Signature-256`) MUST be validated using `crypto.timingSafeEqual` with buffer length validation to prevent timing attacks.
- **Session Security**: Session cookies must be signed, `httpOnly`, `secure` (in production), and `sameSite: "lax"`.
- **Authorization**: All repository and rule operations must verify that the requesting user owns or has admin access to the target repository.

## Commands Reference
- `npm install`: Install project dependencies
- `docker compose up -d`: Launch PostgreSQL database container
- `npm run db:push`: Synchronize Prisma schema with PostgreSQL
- `npm run dev`: Start development server on port 3000 (`http://localhost:3000`)
- `npm run build`: Validate Prisma schema and compile Next.js production bundle
