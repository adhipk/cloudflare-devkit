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

## Create a test project

```bash
bun run new hono-api hello-worker
cd projects/hello-worker
bun install
```

Run locally:

```bash
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
bun test
```

Dry-run a generated project:

```bash
cd ../../
bun run dryrun hello-worker
```

## Local deploy

From inside the project:

```bash
bun run deploy
```

Or from the repo root:

```bash
bun run deploy hello-worker
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
project: hello-worker
command: deploy --dry-run
```

Then:

```txt
project: hello-worker
command: deploy
```

## Generated projects

Projects are generated into:

```txt
projects/<project-name>
```

Currently `projects/` is gitignored.

For GitHub deployments either:

```txt
1. Remove projects/ from .gitignore
```

or

```txt
2. Move the generated project into its own repository
```

The second approach is recommended for long-term use.
