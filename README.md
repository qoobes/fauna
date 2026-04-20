# FAUNA — Flow Analysis for Universal Navigation Accessibility

A community web accessibility analyser built for the University of Liverpool. FAUNA crawls target websites, runs deterministic WCAG checks via axe-core, captures visual screenshots, and uses Claude's vision capabilities to identify the structural and contextual accessibility issues that automated tools systematically miss.

## What it does

1. **Crawl** — BFS traversal starting from a seed URL, respecting depth and page limits
2. **Analyse** — axe-core runs WCAG 2.1 AA checks; Claude analyses screenshots + cleaned HTML for issues requiring human judgment
3. **Score** — Per-page scores with capped severity weighting; overall site score combines page average + cross-page consistency
4. **Cross-page flow analysis** — Detects inconsistent navigation, landmark usage, heading hierarchies, and skip-link presence across pages

## Tech stack

- **Next.js 16** (App Router, React 19, TypeScript)
- **Turso** (libSQL database via Drizzle ORM)
- **Auth.js v5** (magic-link email authentication, @liverpool.ac.uk domain gate)
- **Playwright** (headless Chromium for rendering + screenshots)
- **@axe-core/playwright** (deterministic WCAG 2.1 AA checks)
- **Claude API** (vision-based accessibility analysis with two-pass review)
- **Railway** (deployment with persistent volume for screenshots)

## Local development

```bash
# Prerequisites: Node 20+, bun
bun install
bunx playwright install chromium

# Configure environment
cp .env.example .env
# Fill in: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, RESEND_API_KEY, ANTHROPIC_API_KEY, AUTH_SECRET

# Run migrations
bun run db:push

# Start dev server
bun run dev
```

Open http://localhost:3000. You'll be redirected to `/sign-in` — enter a `@liverpool.ac.uk` email address to receive a magic-link.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | 32+ char secret for JWT signing |
| `AUTH_URL` | Prod only | Public URL (e.g. `https://fauna-production.up.railway.app`) |
| `TURSO_DATABASE_URL` | Yes | libSQL connection URL |
| `TURSO_AUTH_TOKEN` | Yes | Turso auth token |
| `RESEND_API_KEY` | Yes | Resend API key for sending magic-link emails |
| `EMAIL_FROM` | Yes | Sender address (e.g. `FAUNA <noreply@your-domain.com>`) |
| `ANTHROPIC_API_KEY` | No | Claude API key for AI analysis (axe-core works without it) |
| `ALLOWED_EMAIL_DOMAIN` | No | Email domain gate (default: `liverpool.ac.uk`) |
| `MAX_CONCURRENT_SCANS` | No | Concurrent scan limit (default: `3`) |
| `RESULTS_DIR` | No | Screenshot storage path (default: `./results`) |

## Deployment (Railway)

The project includes a `Dockerfile` and `railway.json` for Railway deployment:

```bash
# Install Railway CLI
brew install railway

# Login + create project
railway login
railway init --name fauna

# Add service with env vars
railway add --service fauna --variables "NODE_ENV=production" ...

# Add persistent volume for screenshots
railway volume add --mount-path /app/results

# Deploy
railway up
```

Set `RAILWAY_RUN_UID=0` and `AUTH_TRUST_HOST=true` as service variables for volume permissions and proxy header trust.

## Architecture

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── (auth)/             # Sign-in flow (unprotected)
│   ├── (app)/              # Authenticated pages (home, scans, account)
│   └── api/scans/          # REST API + SSE endpoint
├── components/             # React components (brand, layout, scan views)
├── hooks/                  # useSSE real-time progress hook
├── lib/
│   ├── db/                 # Drizzle schema + client
│   ├── auth/               # Domain gate + email template
│   └── scanner/            # Crawler, axe, AI analyser, scorer
└── types/                  # Shared TypeScript interfaces
```

## License

MIT
