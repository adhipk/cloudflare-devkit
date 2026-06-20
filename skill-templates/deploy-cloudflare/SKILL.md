---
name: deploy-cloudflare
description: Set up, validate, and operate Cloudflare Worker deployments from a consumer repository. Use when asked to add Cloudflare deployment, generate GitHub Actions for Wrangler deploys, create a Worker from cloudflare-devkit recipes, dry-run or deploy a Worker, troubleshoot missing Wrangler config or GitHub secrets, or prepare a repo for Cloudflare CI/CD.
---

# Deploy Cloudflare

Use this skill to make a repository deployable to Cloudflare Workers with `cloudflare-devkit` conventions.

## Agent Bootstrap

Before creating or changing Cloudflare deployment files, make sure the current agent has the official Cloudflare skills and MCP servers available. This setup is part of the task; run the setup commands directly instead of asking the user to run them.

1. Fetch the current official Cloudflare setup prompt:

   ```bash
   curl -fsSL https://developers.cloudflare.com/agent-setup/prompt.md
   ```

2. Follow the section for the active agent from that prompt. For Codex, the setup currently includes:

   ```bash
   npx -y skills add cloudflare/skills --skill '*' --yes --global
   codex mcp add cloudflare --url https://mcp.cloudflare.com/mcp
   codex mcp add cloudflare-docs --url https://docs.mcp.cloudflare.com/mcp
   codex mcp add cloudflare-bindings --url https://bindings.mcp.cloudflare.com/mcp
   codex mcp add cloudflare-builds --url https://builds.mcp.cloudflare.com/mcp
   codex mcp add cloudflare-observability --url https://observability.mcp.cloudflare.com/mcp
   codex mcp login cloudflare
   ```

   For Claude Code, Cursor, GitHub Copilot, Windsurf, OpenCode, and other agents, use the exact commands or config paths from the fetched prompt.

3. If MCP registration requires an agent restart or reload, keep working on repository-local setup that does not require live Cloudflare account access, then tell the user the exact restart/reload needed.

4. Once available, prefer Cloudflare MCP tools for current product docs, binding metadata, build data, and observability. If MCP tools are not available yet, fetch the relevant page from `https://developers.cloudflare.com/` and clearly note the fallback.

## Workflow

1. Inspect the repo before editing:
   - Find Worker targets with `rg --files -g 'wrangler.*' -g 'package.json'`.
   - Identify whether the Worker is at repo root or in a subdirectory.
   - Check existing `.github/workflows/` and `.agents/skills/` before adding files.

2. If there is no Worker yet, generate one from a recipe:

   ```bash
   bunx adhipk/cloudflare-devkit#main create hono-api apps/my-api --name my-api --workflow
   ```

   Pick the closest recipe: `static-html`, `hono-api`, `hono-d1-api`, `hono-r2-api`, or `cron-worker`.

3. If the Worker exists but CI is missing, generate only the workflow caller:

   ```bash
   bunx adhipk/cloudflare-devkit#main workflow cloudflare-worker --target apps/my-api
   ```

   Use `--target .` or omit `--target` for a root Worker. Use `--environment <name>` only when the repo uses GitHub Environments. The generated workflow should call:

   ```txt
   adhipk/cloudflare-devkit/.github/workflows/deploy-cloudflare-worker.yml@main
   ```

   If the repo requires stable central workflow behavior, regenerate with `--devkit-ref <version-tag>`.

4. Confirm required GitHub secrets are documented for the target repo:

   ```txt
   CLOUDFLARE_API_TOKEN
   CLOUDFLARE_ACCOUNT_ID
   ```

   Do not print, invent, or commit secret values.

5. Validate locally before claiming the deployment path works:

   ```bash
   bun install
   bun run types
   bunx wrangler deploy --dry-run
   ```

   If `scripts.types` is absent, skip `bun run types`. For subdirectory Workers, run these commands from that subdirectory.

6. Deploy only when explicitly asked:

   ```bash
   bunx wrangler deploy
   ```

## Guardrails

- Do not add custom domains unless the user provides a hostname or the repo already has one configured.
- Do not overwrite existing workflows or skills without checking whether `--force` is appropriate.
- Prefer `bunx adhipk/cloudflare-devkit#main workflow ...` over hand-writing GitHub Actions YAML.
- Keep Cloudflare deployment mechanics centralized in `adhipk/cloudflare-devkit/.github/workflows/deploy-cloudflare-worker.yml`; consumer repos should carry only caller workflows.
- Keep generated deployment files scoped to the Worker target; for monorepos, use `--target <directory>`.
- If `bunx adhipk/cloudflare-devkit` fails with 404, verify the repo spelling is `cloudflare-devkit`.
