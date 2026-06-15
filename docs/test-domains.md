# Test deployment domains

These examples use Cloudflare Worker Custom Domains under `adhipk.dev` so deploys do not require a `workers.dev` subdomain.

## Current test domains

```txt
hello-worker  hello-worker.adhipk.dev
static        static.adhipk.dev
api           api.adhipk.dev
d1            d1.adhipk.dev
r2            r2.adhipk.dev
cron          cron.adhipk.dev
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
curl https://hello-worker.adhipk.dev/health
```

Expected response:

```json
{"ok":true}
```
