# Cloudflare Devkit

Copyable Cloudflare recipe examples for common service shapes. Each recipe is a small, deployable directory with its own `package.json` and `wrangler.jsonc`.

## Recipes

```txt
static-html      Cloudflare Workers Assets static site
hono-api         Hono JSON API Worker
hono-d1-api      Hono API starter reserved for D1-backed services
hono-r2-api      Hono API starter reserved for R2-backed services
cron-worker      Scheduled Worker with a health endpoint
```

## Check And Dry-Run

```bash
bun install
bun run list
bun run check
bun run validate
bun run test
```

Dry-run one target:

```bash
bun run deploy recipes/hono-api deploy --dry-run
```

Deploy one target:

```bash
bun run deploy recipes/hono-api
```

The root deploy wrapper stages the target in a temp directory, installs dependencies there, and runs Wrangler from the staged copy so recipes stay clean.

## GitHub Deploys

Pushes to `main` that change `recipes/**` run `.github/workflows/deploy-recipes.yml`, which deploys every checked-in recipe. Use `.github/workflows/deploy-project.yml` for manual one-off deploys of a specific recipe or project.

## Test Domains

The checked-in examples deploy to Cloudflare Worker Custom Domains on `adhipk.dev`:

```txt
hello-worker.adhipk.dev
cf-test-static-html.adhipk.dev
cf-test-hono-api.adhipk.dev
cf-test-hono-d1-api.adhipk.dev
cf-test-hono-r2-api.adhipk.dev
cf-test-cron-worker.adhipk.dev
```

`adhipk.dev` must be active in Cloudflare DNS before deploys can attach these domains.
