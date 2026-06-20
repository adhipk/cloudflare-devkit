import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const skillTemplatesDir = path.join(repoRoot, "skill-templates");
const defaultSkill = "deploy-cloudflare";
const builtInSkills = new Set([defaultSkill]);

type SkillOptions = {
  skill: string;
  projectDir: string;
  force: boolean;
};

if (import.meta.main) {
  await runSkill(process.argv.slice(2), { commandName: "bun run skill" });
}

export async function runSkill(args: string[], context: { commandName?: string } = {}) {
  const commandName = context.commandName ?? "cloudflare-devkit skill";
  const options = parseArgs(args, commandName);
  const source = await resolveSkill(options.skill);
  const projectDir = path.resolve(process.cwd(), options.projectDir);
  const destinationDir = path.join(projectDir, ".agents", "skills", options.skill);

  if (existsSync(destinationDir) && !options.force) {
    console.error(`Skill already exists: ${destinationDir}`);
    console.error("Pass --force to overwrite files in that skill directory.");
    process.exit(1);
  }

  if (source.kind === "directory") {
    await copyDirectory(source.dir, destinationDir);
  } else {
    await writeBuiltInSkill(source.skill, destinationDir);
  }

  console.log(`Installed ${options.skill} skill at ${destinationDir}`);
}

function parseArgs(args: string[], commandName: string): SkillOptions {
  const parsed: SkillOptions = {
    skill: defaultSkill,
    projectDir: ".",
    force: false,
  };
  const positionals: string[] = [];

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      printUsage(commandName);
      process.exit(0);
    }

    if (arg === "--force") {
      parsed.force = true;
      continue;
    }

    if (arg.startsWith("--")) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }

    positionals.push(arg);
  }

  if (positionals.length === 1) {
    if (isKnownSkill(positionals[0])) {
      parsed.skill = positionals[0];
    } else {
      parsed.projectDir = positionals[0];
    }
  } else if (positionals.length === 2) {
    parsed.skill = positionals[0];
    parsed.projectDir = positionals[1];
  } else if (positionals.length > 2) {
    console.error(`Unexpected argument: ${positionals[2]}`);
    process.exit(1);
  }

  return parsed;
}

function printUsage(commandName: string) {
  console.error(`Usage: ${commandName} [skill] [project-dir] [--force]`);
  console.error("");
  console.error("Examples:");
  console.error(`  ${commandName}`);
  console.error(`  ${commandName} deploy-cloudflare`);
  console.error(`  ${commandName} deploy-cloudflare ../my-repo --force`);
  console.error("");
  console.error("Skills:");
  console.error("  deploy-cloudflare");
}

async function resolveSkill(skill: string) {
  const sourceDir = path.join(skillTemplatesDir, skill);

  if (existsSync(path.join(sourceDir, "SKILL.md"))) {
    return { kind: "directory" as const, dir: sourceDir };
  }

  if (builtInSkills.has(skill)) {
    return { kind: "builtin" as const, skill };
  }

  const skills = await listSkills();
  console.error(`Unknown skill template: ${skill}`);
  if (skills.length > 0) {
    console.error(`Available skills: ${skills.join(", ")}`);
  }
  process.exit(1);
}

function isKnownSkill(value: string) {
  return builtInSkills.has(value) || existsSync(path.join(skillTemplatesDir, value, "SKILL.md"));
}

async function listSkills() {
  if (!existsSync(skillTemplatesDir)) return [];

  const fileSkills = (await readdir(skillTemplatesDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && existsSync(path.join(skillTemplatesDir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();

  return Array.from(new Set([...builtInSkills, ...fileSkills])).sort();
}

async function copyDirectory(sourceDir: string, targetDir: string) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function writeBuiltInSkill(skill: string, targetDir: string) {
  if (skill !== defaultSkill) {
    console.error(`No built-in skill writer for: ${skill}`);
    process.exit(1);
  }

  await mkdir(path.join(targetDir, "agents"), { recursive: true });
  await writeFile(path.join(targetDir, "SKILL.md"), deployCloudflareSkillMarkdown);
  await writeFile(path.join(targetDir, "agents", "openai.yaml"), deployCloudflareOpenAiYaml);
}

const deployCloudflareSkillMarkdown = String.raw`---
name: deploy-cloudflare
description: Set up, validate, and operate Cloudflare Worker deployments from a consumer repository. Use when asked to add Cloudflare deployment, generate GitHub Actions for Wrangler deploys, create a Worker from cloudflare-devkit recipes, dry-run or deploy a Worker, troubleshoot missing Wrangler config or GitHub secrets, or prepare a repo for Cloudflare CI/CD.
---

# Deploy Cloudflare

Use this skill to make a repository deployable to Cloudflare Workers with cloudflare-devkit conventions.

## Workflow

1. Inspect the repo before editing:
   - Find Worker targets with rg --files -g 'wrangler.*' -g 'package.json'.
   - Identify whether the Worker is at repo root or in a subdirectory.
   - Check existing .github/workflows/ and .agents/skills/ before adding files.

2. If there is no Worker yet, generate one from a recipe:

   \`\`\`bash
   bunx adhipk/cloudflare-devkit#main create hono-api apps/my-api --name my-api --workflow
   \`\`\`

   Pick the closest recipe: static-html, hono-api, hono-d1-api, hono-r2-api, or cron-worker.

3. If the Worker exists but CI is missing, generate only the workflow caller:

   \`\`\`bash
   bunx adhipk/cloudflare-devkit#main workflow cloudflare-worker --target apps/my-api
   \`\`\`

   Use --target . or omit --target for a root Worker. Use --environment <name> only when the repo uses GitHub Environments. The generated workflow should call:

   \`\`\`txt
   adhipk/cloudflare-devkit/.github/workflows/deploy-cloudflare-worker.yml@main
   \`\`\`

   If the repo requires stable central workflow behavior, regenerate with --devkit-ref <version-tag>.

4. Confirm required GitHub secrets are documented for the target repo:

   \`\`\`txt
   CLOUDFLARE_API_TOKEN
   CLOUDFLARE_ACCOUNT_ID
   \`\`\`

   Do not print, invent, or commit secret values.

5. Validate locally before claiming the deployment path works:

   \`\`\`bash
   bun install
   bun run types
   bunx wrangler deploy --dry-run
   \`\`\`

   If scripts.types is absent, skip bun run types. For subdirectory Workers, run these commands from that subdirectory.

6. Deploy only when explicitly asked:

   \`\`\`bash
   bunx wrangler deploy
   \`\`\`

## Guardrails

- Do not add custom domains unless the user provides a hostname or the repo already has one configured.
- Do not overwrite existing workflows or skills without checking whether --force is appropriate.
- Prefer bunx adhipk/cloudflare-devkit#main workflow ... over hand-writing GitHub Actions YAML.
- Keep Cloudflare deployment mechanics centralized in adhipk/cloudflare-devkit/.github/workflows/deploy-cloudflare-worker.yml; consumer repos should carry only caller workflows.
- Keep generated deployment files scoped to the Worker target; for monorepos, use --target <directory>.
- If bunx adhipk/cloudflare-devkit fails with 404, verify the repo spelling is cloudflare-devkit.
`;

const deployCloudflareOpenAiYaml = String.raw`interface:
  display_name: "Deploy Cloudflare"
  short_description: "Deploy Cloudflare Workers from this repo"
  default_prompt: "Use $deploy-cloudflare to set up and validate Cloudflare deployment for this repo."
`;
