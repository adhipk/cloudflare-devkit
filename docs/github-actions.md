# GitHub Actions deployment

This repo supports two deployment modes.

## Monorepo target deploys

Use `.github/workflows/deploy-project.yml`.

It is manual by default. Run it from GitHub Actions and provide:

```txt
target: recipes/hono-api
command: deploy --dry-run
```

Then run again with:

```txt
target: recipes/hono-api
command: deploy
```

The workflow accepts any checked-in recipe or project directory that contains `package.json` and `wrangler.jsonc`, for example:

```txt
recipes/static-html
recipes/hono-api
projects/hello-worker
```

## Standalone project deploys

Copy this file into a generated repo:

```txt
workflow-templates/cloudflare-worker.yml
```

Place it at:

```txt
.github/workflows/deploy.yml
```

It will:

```txt
1. install Bun dependencies
2. run types if present
3. run wrangler deploy --dry-run
4. deploy on push to main
```

## Required GitHub secrets

```txt
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

## Recommended first tests

```bash
bun run validate
bun run deploy recipes/hono-api deploy --dry-run
bun run deploy recipes/static-html deploy --dry-run
```

Then use the `deploy target` GitHub Action with:

```txt
target: recipes/hono-api
command: deploy --dry-run
```
