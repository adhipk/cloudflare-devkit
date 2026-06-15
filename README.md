# cloudflare-devkit

A small personal project factory for Cloudflare deployments.

Use this repo to create repeatable starter projects for Workers, static sites, APIs, D1, R2, and scheduled jobs.

## What this is

```txt
cloudflare-devkit/
  recipes/        Reusable starter projects
  scripts/        Bun scripts for scaffolding and deploy helpers
  docs/           Setup notes and conventions
```

The goal is simple: future projects should start from a known recipe and deploy with Wrangler.

## Quick start

```bash
bun install
bun run list
bun run new hono-api my-api
cd projects/my-api
bun install
bun run dev
```

## Recipes

```txt
static-html       Static HTML/CSS/JS served by Workers Assets
hono-api          Basic Hono API on Cloudflare Workers
hono-d1-api       Hono API with a D1 binding and migration
hono-r2-api       Hono API with an R2 bucket binding
cron-worker       Scheduled Worker template
astro-blog        Placeholder recipe for a future personal site/blog
```

## Project convention

Generated projects go into `projects/` by default:

```txt
projects/
  my-api/
  my-blog/
```

Each project owns its own `wrangler.jsonc` and deployment scripts.

## Cloudflare setup

You will need:

```txt
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

For local deploys, run:

```bash
bunx wrangler login
```

For GitHub Actions, add the secrets to each deploy repo or this repo if using a monorepo.

## Commands

```bash
bun run list
bun run new <recipe> <project-name>
bun run deploy <project-name>
```
