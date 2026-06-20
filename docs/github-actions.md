# GitHub Actions deployment

This repo is the central deployment workflow repository for Cloudflare Worker consumers. Consumer repositories should keep only a small caller workflow and let this repo own the install, type generation, Wrangler dry-run, and deploy steps.

## Central reusable workflow

The reusable workflow lives at:

```txt
.github/workflows/deploy-cloudflare-worker.yml
```

Consumer repositories call it with:

```yaml
jobs:
  deploy:
    uses: adhipk/cloudflare-devkit/.github/workflows/deploy-cloudflare-worker.yml@main
    with:
      target: "."
      deploy: ${{ github.ref == 'refs/heads/main' && github.event_name == 'push' }}
    secrets:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Use `@main` while iterating. Use a version tag once the central workflow is released and consumers need stable behavior.

The central workflow uses the official Cloudflare Wrangler Action:

```txt
cloudflare/wrangler-action@v4.0.0
```

## Automatic recipe deploys

Use `.github/workflows/deploy-recipes.yml`.

On pushes to `main` that change `recipes/**`, it deploys every checked-in recipe:

```txt
recipes/static-html
recipes/hono-api
recipes/hono-d1-api
recipes/hono-r2-api
recipes/cron-worker
```

The workflow can also be run manually from GitHub Actions.

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

The `deploy` mode runs a dry-run first, then deploys only if that succeeds.

The workflow accepts any checked-in recipe or project directory that contains `package.json` and `wrangler.jsonc`, for example:

```txt
recipes/static-html
recipes/hono-api
projects/hello-worker
```

## Consumer project deploys

Generate a caller workflow into a consumer repo:

```txt
bunx adhipk/cloudflare-devkit#main workflow cloudflare-worker --target .
```

For a monorepo target:

```txt
bunx adhipk/cloudflare-devkit#main workflow cloudflare-worker --target apps/api --name deploy-api
```

That writes `.github/workflows/deploy.yml` by default. The generated workflow:

```txt
1. triggers on push to main and workflow_dispatch
2. path-filters to the target directory for monorepo targets
3. calls the central reusable workflow in this repo
4. dry-runs on every run
5. deploys only on pushes to main
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
