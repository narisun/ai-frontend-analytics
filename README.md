# Analytics Dashboard

Next.js 15 + Shadcn/ui + Vercel AI SDK + Recharts frontend for the Enterprise Agentic Analytics Platform.

## Tech Stack

- **Framework:** Next.js 15 (App Router, standalone output)
- **UI Components:** Shadcn/ui (Radix primitives + Tailwind CSS)
- **Styling:** Tailwind CSS v4 (dark theme)
- **Streaming:** Vercel AI SDK v4 (`useChat` with Data Stream Protocol)
- **Charts:** Recharts (Bar, Line, Area, Pie, KPI, DataTable)
- **Markdown:** react-markdown + remark-gfm

## Development

```bash
npm install
npm run dev     # http://localhost:3003
```

The dev server proxies `/api/v1/*` requests to the analytics-agent backend via `next.config.ts` rewrites.

## Required runtime env vars

- `ENVIRONMENT` — one of `dev` | `staging` | `prod`. Stamped on every backend call as `X-Environment`. The agent rejects mismatches with 403.
- `REGISTRY_URL` — service registry URL (defaults to `http://ai-registry:8090` in the Docker image; override for staging/prod). The frontend looks up `analytics-agent` here at request time. If the registry is unreachable, the chat route returns 503 with a clear error.
- `INTERNAL_API_KEY` — Bearer token forwarded to the analytics-agent. Required.
- `AUTH0_*` — see `lib/auth0.ts` for the full set.

`ANALYTICS_AGENT_URL` is no longer read at runtime; service discovery happens via the registry. The Dockerfile keeps it as a build-time placeholder for legacy compatibility.

## Docker

```bash
# From the monorepo root:
docker compose up analytics-dashboard
# Open http://localhost:3003
```

## Architecture

- **Backend:** The analytics-agent exposes `POST /api/v1/analytics/chat` emitting the Vercel AI SDK Data Stream Protocol
- **Frontend:** `useChat` from `@ai-sdk/react` handles streaming, message state, and protocol parsing natively
- **UI Components:** Charts, KPIs, and tables arrive as `2:` (data) events and are rendered inline within assistant messages
- **Reasoning:** Intent classification and tool call activity arrive as `g:` (reasoning) tokens and render in collapsible ThinkingBlock components
- **Conversations:** Stored client-side via localStorage, grouped by time in the sidebar
