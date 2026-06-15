# Test deployment domains

These examples use Cloudflare Worker Custom Domains under `adhipk.dev` so deploys do not require a `workers.dev` subdomain.

## Current test domains

```txt
hello-worker  hello-worker.adhipk.dev
static        cf-test-static-html.adhipk.dev
api           cf-test-hono-api.adhipk.dev
d1            cf-test-hono-d1-api.adhipk.dev
r2            cf-test-hono-r2-api.adhipk.dev
cron          cf-test-cron-worker.adhipk.dev
```

## Wrangler custom domain pattern

Cloudflare recommends Custom Domains when the Worker is the origin. In `wrangler.jsonc`, that is represented as a `routes` entry with `custom_domain: true`:

```jsonc
"routes": [
  {
    "pattern": "hello-worker.adhipk.dev",
    "custom_domain": true
  }
]
```

`adhipk.dev` must be an active Cloudflare zone before these deploys can create or update the custom domains.

## Validation

After deploy:

```bash
bun run smoke
```

The smoke script curls the recipe endpoints and exits non-zero if any endpoint returns a non-2xx status or cannot be reached.

Expected output:

```txt
OK static: 200 https://cf-test-static-html.adhipk.dev/
OK api: 200 https://cf-test-hono-api.adhipk.dev/
OK api health: 200 https://cf-test-hono-api.adhipk.dev/health
OK d1: 200 https://cf-test-hono-d1-api.adhipk.dev/
OK d1 health: 200 https://cf-test-hono-d1-api.adhipk.dev/health
OK r2: 200 https://cf-test-hono-r2-api.adhipk.dev/
OK r2 health: 200 https://cf-test-hono-r2-api.adhipk.dev/health
OK cron: 200 https://cf-test-cron-worker.adhipk.dev/
```
