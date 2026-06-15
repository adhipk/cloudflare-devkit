# Initial setup

## Install prerequisites

```bash
git clone https://github.com/adhipk/cloudflare-devkit
cd cloudflare-devkit
bun install
```

Install and authenticate Wrangler:

```bash
bunx wrangler login
```

Verify authentication:

```bash
bunx wrangler whoami
```

## Explore recipes

```bash
bun run list
```

Run a recipe locally:

```bash
cd recipes/hono-api
bun install
bun run dev
```

## Validation

Static checks:

```bash
bun run check
```

Validate all recipes:

```bash
bun run validate
```

Run everything:

```bash
bun run test
```

Dry-run a recipe or project:

```bash
bun run dryrun recipes/hono-api
bun run dryrun projects/hello-worker
```

## Local deploy

From inside a recipe or project:

```bash
bun run deploy
```

Or from the repo root:

```bash
bun run deploy recipes/hono-api
bun run deploy recipes/static-html
```

## GitHub Actions deployment

Add repository secrets:

```txt
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

Recommended API token permissions:

```txt
Workers Scripts: Edit
Account Settings: Read
D1: Edit
R2: Edit
DNS: Edit (only if using domains)
```

Run the workflow:

```txt
.github/workflows/deploy-project.yml
```

First run:

```txt
target: recipes/hono-api
command: deploy --dry-run
```

Then:

```txt
target: recipes/hono-api
command: deploy
```

## Recipe directories

Each recipe is a working example and a copyable template:

```txt
recipes/<recipe-name>
```

Use `projects/` for committed deployment tests or service-specific examples.

For custom domains, add route entries to the target `wrangler.jsonc` only after the zone is configured in Cloudflare. See `docs/test-domains.md`.
