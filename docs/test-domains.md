# Test deployment domains

Use this convention for committed Cloudflare deployment tests:

```txt
cf-deploy-test-<deployment-type>.adhipk.dev
```

## Current test domains

```txt
worker        cf-deploy-test-worker.adhipk.dev
static        cf-deploy-test-static.adhipk.dev
d1            cf-deploy-test-d1.adhipk.dev
r2            cf-deploy-test-r2.adhipk.dev
cron          cf-deploy-test-cron.adhipk.dev
```

## Wrangler route pattern

For a Worker custom domain, add this to the project `wrangler.jsonc`:

```jsonc
"routes": [
  {
    "pattern": "cf-deploy-test-worker.adhipk.dev",
    "custom_domain": true
  }
]
```

Replace `worker` with the deployment type.

## Validation

After deploy:

```bash
curl https://cf-deploy-test-worker.adhipk.dev/health
```

Expected response:

```json
{"ok":true}
```
