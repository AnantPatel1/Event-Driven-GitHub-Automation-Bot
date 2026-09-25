# AGENTS.md — Agent Guidelines & Architecture Manual

## Overview
This repository implements an event-driven GitHub Automation Bot that connects to GitHub repositories, verifies and ingests webhooks idempotently, evaluates configurable rules, and executes downstream actions (GitHub API labels/comments + Slack notifications).

## Monorepo Layout
- `apps/web`: Next.js 15 App Router frontend (Port 3000)
- `apps/server`: Fastify Node.js TypeScript API & webhook processor (Port 4000)
- `packages/shared`: Shared TypeScript types, schemas, and DTOs
- `prisma/schema.prisma`: Centralized database schema
- `docker-compose.yml`: Local PostgreSQL 16 container on port 5433

## Architecture & Engineering Decisions
1. **Fastify Webhook Ingestion**: Fastify is preferred over standard Express for lower latency, built-in schema validation, and precise control over raw payload bytes necessary for HMAC-SHA256 signature verification.
2. **Idempotency by Design**: Webhook deduplication is strictly enforced at the database level via `GitHubEvent.deliveryId UNIQUE`. In-memory Sets are not used as they fail across worker restarts.
3. **Decoupled Ingestion & Processing**: The webhook endpoint responds 2xx immediately after signature verification and persistence. Slow external operations (GitHub API / Slack webhook) run asynchronously.
4. **Port Mapping**: PostgreSQL is mapped to port `5433:5432` to avoid collisions with any existing local PostgreSQL instances on port 5432.

## Security Conventions
- **Zero Secret Leakage**: Secrets (`GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `SLACK_WEBHOOK_URL`, `SESSION_SECRET`) must never be prefixed with `NEXT_PUBLIC_` or sent to the browser.
- **Constant-Time Comparison**: Webhook signatures (`X-Hub-Signature-256`) MUST be validated using `crypto.timingSafeEqual` to prevent timing attacks.
- **Session Security**: Session cookies must be `httpOnly`, `secure` (in production), and `sameSite: "lax"`.
- **Authorization**: All repository and rule operations must verify that the requesting user owns or has admin access to the target repository.

## Commands Reference
- `npm install`: Install dependencies across all workspaces
- `npm run build:shared`: Compile shared TypeScript library
- `docker compose up -d`: Launch PostgreSQL database container
- `npm run db:push`: Synchronize Prisma schema with PostgreSQL
- `npm run dev`: Start both backend (`:4000`) and frontend (`:3000`) concurrently
- `npm run dev:server`: Start backend only
- `npm run dev:web`: Start frontend only
- `npm run test`: Run automated test suites
