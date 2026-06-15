# GitHub Actions deployment

This repo supports two deployment modes.

## Monorepo project deploys

Use `.github/workflows/deploy-project.yml`.

It is manual by default. Run it from GitHub Actions and provide:

```txt
project: my-api
command: deploy --dry-run
```

Then run again with:

```txt
project: my-api
command: deploy
```

The workflow expects the generated project to live at:

```txt
projects/<project-name>
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

## Recommended first test

```bash
bun run new hono-api hello-worker
cd projects/hello-worker
bun install
bun run dev
```

Then use the `deploy project` GitHub Action with:

```txt
project: hello-worker
command: deploy --dry-run
```
