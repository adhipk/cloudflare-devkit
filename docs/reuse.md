# Reusing recipes from other projects

Use this repo as the source of truth for small, deployable Cloudflare service shapes. Keep `recipes/` concrete and validated here, then instantiate a copy into another project with the root `create` command.

## Create a project from a recipe

From this repo:

```bash
bun run create hono-api ../my-api --name my-api --domain api.example.com --workflow
```

Without a custom domain:

```bash
bun run create static-html ../my-site --name my-site
```

The generated project gets:

```txt
package.json
wrangler.jsonc
recipe source files
.github/workflows/deploy.yml  when --workflow is passed
```

By default, the command removes the recipe test route from `wrangler.jsonc`. Pass `--domain <hostname>` only when the target Cloudflare zone is ready.

## Command contract

```bash
bun run create <recipe> <destination> [options]
```

Options:

```txt
--name <worker-name>     Sets wrangler.jsonc name
--package-name <name>    Sets package.json name; defaults to worker name
--domain <hostname>      Adds a custom-domain route
--workflow               Copies the standalone GitHub Actions deploy workflow
```

The destination must be missing or empty. Generated projects intentionally do not copy lockfiles, generated Wrangler types, `node_modules`, `.wrangler`, or `.git`.

## Pull with bunx

From another project, use this repo directly from GitHub:

```bash
bunx adhipk/cloudflare-devkit#v0.1.1 create hono-api . --name my-api --workflow
```

Pull only the standalone GitHub Actions workflow:

```bash
bunx adhipk/cloudflare-devkit#v0.1.1 workflow cloudflare-worker
```

That writes:

```txt
.github/workflows/deploy.yml
```

To choose another destination or overwrite an existing file:

```bash
bunx adhipk/cloudflare-devkit#v0.1.1 workflow cloudflare-worker .github/workflows/cloudflare.yml --force
```

## Install the consumer skill

Install the `deploy-cloudflare` skill into another repo:

```bash
bunx adhipk/cloudflare-devkit#v0.1.1 skill deploy-cloudflare
```

That writes:

```txt
.agents/skills/deploy-cloudflare/SKILL.md
.agents/skills/deploy-cloudflare/agents/openai.yaml
```

Install it into a different project directory:

```bash
bunx adhipk/cloudflare-devkit#v0.1.1 skill deploy-cloudflare ../my-repo
```

Use `--force` only when replacing an existing local copy.

The skill tells future agents how to add Cloudflare GitHub Actions, check Wrangler targets, document required GitHub secrets, and dry-run before deploy.

Use `#main` for active development and version tags like `#v0.1.1` for repeatable consumer installs. Unpinned GitHub `bunx` specs can reuse cached tarballs.

## Bin bundle

The executable package entrypoint is the bundled file:

```txt
dist/cloudflare-devkit.js
```

After changing CLI code in `bin/` or `scripts/`, rebuild it:

```bash
bun run build:bin
```

## Recommended organization

Use these boundaries:

```txt
recipes/              reusable, validated Cloudflare starters
projects/             checked-in deployments owned by this repo
workflow-templates/   files copied into standalone projects
scripts/              lifecycle commands for recipes and projects
docs/                 operating notes and reuse contract
```

Agent-facing skills should be thin instructions on top of this contract. They should tell the agent which recipe to pick and then run `bun run create`; the script should remain the source of truth for how files are copied and rewritten.
