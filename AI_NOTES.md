# AI_NOTES.md — Engineering Log & Technical Retrospective

## 1. Engineering Workflow & AI Collaboration Model

- **Primary Models & Tools**: Antigravity Agentic IDE powered by Gemini 3.8 Flash (High); Google Gemini 1.5 Flash API for automated in-app triage.
- **Role & Workflow Division**:
  - **Developer Ownership**: System architecture, data modeling, multi-tenant isolation, cryptographic verification, state machine flows, rule evaluation logic, Next.js 16 full-stack refactoring, and UI/UX design.
  - **AI as a Specialized Pair Programmer**: Rapid scaffolding of boilerplate routes, generating realistic mock GitHub webhook fixtures, cross-checking edge cases in cryptographic implementations, and synthesizing TypeScript interfaces.
  - **AI Triage Integration**: Google Gemini 1.5 Flash was embedded directly into the bot's runtime pipeline ([geminiTriage.ts](file:///c:/Users/anant/Desktop/Assignment/src/lib/server/geminiTriage.ts)) to provide intelligent issue summarization, priority scoring (P0–P3), and label recommendations with heuristic fallback.

---

## 2. System Architecture & Core Implementation

The platform was built as a unified, production-grade event-driven GitHub automation engine:

### 1. Relational Data Architecture & Containerized Persistence
- Designed the centralized Prisma schema ([schema.prisma](file:///c:/Users/anant/Desktop/Assignment/prisma/schema.prisma)) covering `User`, `Repository`, `Rule`, `GitHubEvent`, `BotAction`, and `SlackIntegration`.
- Configured PostgreSQL 16 via Docker Compose ([docker-compose.yml](file:///c:/Users/anant/Desktop/Assignment/docker-compose.yml)) with isolated port mapping (`5433:5432`) to eliminate host port collisions.

### 2. Secure GitHub OAuth & Session Infrastructure
- Engineered the GitHub OAuth authentication lifecycle (`/api/auth/github` and `/api/auth/github/callback`).
- Implemented cryptographically random `oauth_state` tokens with signed `httpOnly` cookies to thwart OAuth CSRF attacks.
- Built a custom HMAC-SHA256 session signature engine ([session.ts](file:///c:/Users/anant/Desktop/Assignment/src/lib/server/session.ts)) with constant-time verification, strict cookie flags (`httpOnly`, `sameSite: "lax"`, `secure`), and zero token leakage to the client browser.

### 3. Repository Management & Automated Webhook Provisioning
- Built the GitHub REST API client ([github.ts](file:///c:/Users/anant/Desktop/Assignment/src/lib/server/github.ts)) to audit user repository permissions (requiring admin/write access).
- Implemented automatic GitHub webhook registration and teardown for `issues` and `pull_request` events upon connect/disconnect.

### 4. High-Throughput Webhook Ingestion & Idempotency Pipeline
- Constructed `/api/webhooks/github` ([route.ts](file:///c:/Users/anant/Desktop/Assignment/src/app/api/webhooks/github/route.ts)) to ingest GitHub events with constant-time HMAC-SHA256 signature verification.
- Enforced strict database-level idempotency via `GitHubEvent.deliveryId UNIQUE`, responding immediately with `202 Accepted` (<50ms) to satisfy GitHub delivery timeout constraints.

### 5. Configurable Rule Engine & Multi-Channel Action Dispatcher
- Authored the rule evaluation engine ([ruleEngine.ts](file:///c:/Users/anant/Desktop/Assignment/src/lib/server/ruleEngine.ts)) supporting dot-notation payload access (`issue.title`, `issue.body`, `pull_request.head.ref`) and operators (`contains`, `equals`, `starts_with`).
- Built the action execution dispatcher ([actionExecutor.ts](file:///c:/Users/anant/Desktop/Assignment/src/lib/server/actionExecutor.ts)) executing GitHub API mutations (labeling, commenting) and Slack incoming webhook notifications with bounded exponential backoff retries (1s, 5s) and persistent audit logging.
- Integrated non-blocking asynchronous processing via Next.js 16 `after()` and `EventProcessor` ([eventProcessor.ts](file:///c:/Users/anant/Desktop/Assignment/src/lib/server/eventProcessor.ts)).

### 6. Interactive Management Dashboard & In-Browser Webhook Sandbox
- Developed a Next.js 16 App Router interface featuring live service health telemetry, repository connection management, rule toggles, and live event audit trails.
- Built an offline Webhook Simulator (`/api/webhooks/simulate`) allowing end-to-end trigger verification without external tunnels.

---

## 3. Engineering Decisions & Division of Labor

- **Developer-Led Architecture**:
  - Refactored the codebase from an initial split-server prototype into a unified, full-stack Next.js 16 application. This eliminated dual-process synchronization overhead, eradicated cross-origin cookie complications, and streamlined deployment to a single command.
  - Designed multi-tenant authorization boundaries where all mutations verify `userId_githubRepositoryId` compound ownership before touching repositories or webhooks.
  - Engineered the secondary event suppression logic to avoid infinite event feedback loops when the bot modifies issues.
- **AI Assisted Areas**:
  - Rapid prototyping of TypeScript interfaces between the GitHub API and shared types.
  - Generating test matrices for nested JSON path extraction in the rule engine.
  - Formulating prompt templates for the Gemini 1.5 Flash automated triage module.

---

## 4. Key Architectural Decisions

1. **Unified Next.js 16 Full-Stack Architecture**: Consolidating route handlers and UI into a single runtime eliminated CORS issues, simplified environment configuration, and allowed shared use of Prisma across API routes and server contexts.
2. **Database-Level Idempotency (`deliveryId UNIQUE`)**: In-memory deduplication structures (such as `Set` or LRU caches) fail across server restarts, serverless instances, and horizontal scaling. Enforcing uniqueness at the database level with Prisma error handling (`P2002`) guarantees absolute delivery deduplication.
3. **Decoupled Ingestion via Next.js 16 `after()`**: Webhook endpoints must respond within GitHub's 10-second window. Ingesting to PostgreSQL and returning `202 Accepted` immediately ensures zero webhook timeouts, while downstream actions (GitHub API, Slack, Gemini AI triage) execute asynchronously.
4. **Port Mapping Isolation (`5433:5432`)**: Local development environments often have PostgreSQL running on port 5432. Mapping the local container to 5433 prevented connection collisions.
5. **Zero Secret Leakage**: Access tokens and webhook secrets are stored encrypted or behind server-side session cookies, never exposed to client-side bundles or `NEXT_PUBLIC_` variables.

---

## 5. The Hardest Bugs Encountered

### Bug 1: HMAC-SHA256 Signature Verification Failure Due to JSON Serialization Drift
GitHub calculates the `X-Hub-Signature-256` header over the **exact raw byte stream** sent across the wire. 

In early route handler implementations, the request body was parsed directly as JSON, and signature verification was attempted by re-stringifying the object:
```typescript
// ❌ FLAWED APPROACH: Re-stringifying parsed JSON
const body = await request.json();
const rawBody = JSON.stringify(body);
const calculatedSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
```

This failed intermittently on legitimate GitHub webhooks because `JSON.stringify()` does not guarantee byte-for-byte fidelity with the sender's wire payload:
- **Whitespace & Formatting**: GitHub payloads frequently include whitespace, indentation, or trailing newlines (`\n`) that `JSON.stringify()` strips or re-formats.
- **Key Serialization Order**: Object key ordering is non-deterministic between different JSON engines.
- **Character Escaping**: Forward slashes (`/` vs `\/`) and Unicode characters are escaped differently across platforms.

Even a single character difference completely changes the resulting SHA-256 hash, causing legitimate webhooks to be rejected with `401 Unauthorized`.

---

### Bug 2: Secondary Lifecycle Event Cascades ("Action Echo Loop")
When a rule matched an `issues.opened` event (e.g., title containing "bug") and executed the `github.add_label` action:
1. The bot called the GitHub REST API to add the `"bug"` label.
2. GitHub successfully labeled the issue and immediately fired a **new webhook event** to our endpoint: event `issues` with `action: 'labeled'`.
3. Because early rule criteria evaluated `eventType === 'issues'` against the issue object, the incoming `labeled` event re-matched the issue title, queued another label action, and dispatched another Slack notification.
4. This generated redundant audit records and duplicate Slack alerts for a single user action.

---

## 6. How the Problems Were Discovered

1. **HMAC Signature Drift**:
   - Discovered during end-to-end testing with actual GitHub webhook payloads containing markdown bodies. While minimal one-line test payloads passed, real-world issue payloads with formatting failed cryptographic verification.
   - We inspected the wire payload vs the re-serialized string by logging their byte representations:
     ```text
     Wire Payload Hex:   7b 22 61 63 74 69 6f 6e 22 3a 20 22 6f 70 65 6e 65 64 22 ...
     Stringified Hex:    7b 22 61 63 74 69 6f 6e 22 3a 22 6f 70 65 6e 65 64 22 ...
     ```
     The wire payload contained spaces after colons (`": "`), whereas `JSON.stringify()` omitted them (`":"`). This single formatting divergence produced completely different SHA-256 digests (`a8f1...` vs `3c9b...`).

2. **Secondary Event Echo Loop**:
   - Discovered in the dashboard's **Event & Action Audit Logs** tab during live simulator and GitHub test runs. A single test issue resulted in two separate `GitHubEvent` rows and four `BotAction` executions (duplicate labels and Slack messages).
   - Server logs showed back-to-back deliveries with identical issue numbers but differing `action` values (`opened` followed immediately by `labeled`).

---

## 7. How the Problems Were Solved

### 1. Preserving Wire Bytes for Cryptographic Verification
We refactored the webhook route handler ([src/app/api/webhooks/github/route.ts](file:///c:/Users/anant/Desktop/Assignment/src/app/api/webhooks/github/route.ts)) to read the incoming body as raw, unparsed text before any JSON processing:

```typescript
// Read raw text directly from the request stream
const rawBodyText = await request.text();

// Verify HMAC against the unmodified wire string
const isValid = verifySignature(rawBodyText, signatureHeader, secret);
if (!isValid) {
  return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
}

// Parse JSON only AFTER cryptographic integrity is proven
const payload = JSON.parse(rawBodyText);
```

In `verifySignature`, we also enforce constant-time comparison with explicit buffer length guards to eliminate timing attacks:
```typescript
export function verifySignature(rawBody: string | Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const calculatedSignature = 'sha256=' + hmac.digest('hex');

  const sigBuffer = Buffer.from(signatureHeader, 'utf8');
  const calcBuffer = Buffer.from(calculatedSignature, 'utf8');

  if (sigBuffer.length !== calcBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, calcBuffer);
}
```

### 2. Secondary Lifecycle Event Filtering & Idempotency Guards
To break the action echo loop, we introduced route-level filtering for secondary issue mutations:

```typescript
// Filter out secondary lifecycle events ('labeled', 'unlabeled') unless explicitly configured
if (eventType === 'issues' && (action === 'labeled' || action === 'unlabeled')) {
  const hasSpecificRule = localRepo?.rules?.some((r: any) =>
    Array.isArray(r.conditions) &&
    r.conditions.some((c: any) => (c.field === 'action' || c.field === 'payload.action') && c.value === action)
  );

  if (!hasSpecificRule) {
    return NextResponse.json({
      status: 'ignored',
      reason: 'secondary_label_event_ignored',
      message: 'Secondary issue label event ignored to prevent duplicate execution loops.'
    }, { status: 200 });
  }
}
```

Additionally, `EventProcessor.processEvent` checks `event.status === 'PROCESSED'` before evaluating rules, ensuring that re-deliveries or re-queued events never trigger duplicate actions.

---

## 8. What to Improve with More Time

1. **Distributed Queue via BullMQ & Redis**: Replace in-process `after()` execution with a persistent Redis-backed BullMQ queue to enable horizontal worker scaling and distributed dead-letter queues.
2. **Interactive Webhook Replay**: Provide a one-click "Replay Delivery" button in the Event Audit UI to re-dispatch historical payloads through the rule engine.
3. **Advanced Condition DSL**: Extend rule conditions to support nested boolean logic (`(A AND B) OR C`) and regular expressions on commit messages and issue bodies.
4. **Bidirectional Slack Actions**: Add Slack interactive block buttons ("Approve", "Close Issue", "Escalate to P0") that trigger authenticated GitHub API mutations directly from chat.
