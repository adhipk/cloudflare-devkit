#!/usr/bin/env bun
// @bun
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// scripts/list.ts
var exports_list = {};
import { existsSync as existsSync4 } from "fs";
import { readdir as readdir4, readFile as readFile3 } from "fs/promises";
import path4 from "path";
async function printTargets(title, dir) {
  if (!existsSync4(dir))
    return;
  const names = (await readdir4(dir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  console.log(`${title}:`);
  for (const name of names) {
    const packagePath = path4.join(dir, name, "package.json");
    const wranglerPath = path4.join(dir, name, "wrangler.jsonc");
    const packageName = existsSync4(packagePath) ? JSON.parse(await readFile3(packagePath, "utf8")).name : "(missing package.json)";
    const deployable = existsSync4(wranglerPath) ? "deployable" : "missing wrangler.jsonc";
    console.log(`- ${name} (${packageName}) ${deployable}`);
  }
  console.log("");
}
var repoRoot4;
var init_list = __esm(async () => {
  repoRoot4 = path4.resolve(new URL("..", import.meta.url).pathname);
  await printTargets("Recipes", path4.join(repoRoot4, "recipes"));
  await printTargets("Projects", path4.join(repoRoot4, "projects"));
});

// scripts/create.ts
import { existsSync } from "fs";
import { copyFile, mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
var repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
var recipesDir = path.join(repoRoot, "recipes");
var workflowTemplatePath = path.join(repoRoot, "workflow-templates", "cloudflare-worker.yml");
if (false) {}
async function runCreate(args, context = {}) {
  const commandName = context.commandName ?? "cloudflare-devkit create";
  const options = parseArgs(args, commandName);
  if (!options.recipe || !options.destination) {
    printUsage(commandName);
    process.exit(1);
  }
  const recipeDir = resolveRecipe(options.recipe);
  const destinationDir = path.resolve(process.cwd(), options.destination);
  const workerName = options.name ?? slugify(path.basename(destinationDir));
  const packageName = options.packageName ?? workerName;
  if (workerName.length === 0) {
    console.error("Worker name cannot be empty.");
    process.exit(1);
  }
  await assertDestinationAvailable(destinationDir);
  await copyDirectory(recipeDir, destinationDir);
  await rewritePackageJson(path.join(destinationDir, "package.json"), packageName);
  await rewriteWranglerConfig(path.join(destinationDir, "wrangler.jsonc"), workerName, options.domain);
  if (options.workflow) {
    await copyWorkflow(destinationDir);
  }
  console.log(`Created ${destinationDir}`);
  console.log(`Recipe: ${path.basename(recipeDir)}`);
  console.log(`Worker: ${workerName}`);
  if (options.domain) {
    console.log(`Custom domain: ${options.domain}`);
  } else {
    console.log("Custom domain: none; routes removed from wrangler.jsonc");
  }
  if (options.workflow) {
    console.log("Workflow: .github/workflows/deploy.yml");
  }
}
function parseArgs(args, commandName) {
  const parsed = { workflow: false };
  const positionals = [];
  for (let index = 0;index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      printUsage(commandName);
      process.exit(0);
    }
    if (arg === "--workflow") {
      parsed.workflow = true;
      continue;
    }
    if (arg === "--name") {
      parsed.name = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--package-name") {
      parsed.packageName = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--domain") {
      parsed.domain = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
    positionals.push(arg);
  }
  [parsed.recipe, parsed.destination] = positionals;
  if (positionals.length > 2) {
    console.error(`Unexpected argument: ${positionals[2]}`);
    process.exit(1);
  }
  return parsed;
}
function readOptionValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`${option} requires a value.`);
    process.exit(1);
  }
  return value;
}
function printUsage(commandName) {
  console.error(`Usage: ${commandName} <recipe> <destination> [options]`);
  console.error("");
  console.error("Examples:");
  console.error(`  ${commandName} hono-api ../my-api --name my-api --domain api.example.com --workflow`);
  console.error(`  ${commandName} static-html ../site --name my-site`);
  console.error("");
  console.error("Options:");
  console.error("  --name <worker-name>        Worker name for wrangler.jsonc");
  console.error("  --package-name <name>       package.json name; defaults to --name");
  console.error("  --domain <hostname>         Add a custom domain route");
  console.error("  --workflow                  Copy the standalone GitHub Actions deploy workflow");
}
function resolveRecipe(recipe) {
  const candidates = [
    path.resolve(process.cwd(), recipe),
    path.resolve(repoRoot, recipe),
    path.join(recipesDir, recipe)
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "package.json")) && existsSync(path.join(candidate, "wrangler.jsonc"))) {
      return candidate;
    }
  }
  console.error(`Unknown recipe: ${recipe}`);
  process.exit(1);
}
async function assertDestinationAvailable(destinationDir) {
  if (!existsSync(destinationDir))
    return;
  const entries = await readdir(destinationDir);
  if (entries.length > 0) {
    console.error(`Destination already exists and is not empty: ${destinationDir}`);
    process.exit(1);
  }
}
async function rewritePackageJson(packagePath, packageName) {
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.name = packageName;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}
`);
}
async function rewriteWranglerConfig(configPath, workerName, domain) {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.name = workerName;
  if (domain) {
    config.routes = [
      {
        pattern: domain,
        custom_domain: true
      }
    ];
  } else {
    delete config.routes;
  }
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}
`);
}
async function copyWorkflow(destinationDir) {
  const workflowDir = path.join(destinationDir, ".github", "workflows");
  const workflowPath = path.join(workflowDir, "deploy.yml");
  if (existsSync(workflowPath)) {
    console.error(`Workflow already exists: ${workflowPath}`);
    process.exit(1);
  }
  await mkdir(workflowDir, { recursive: true });
  await copyFile(workflowTemplatePath, workflowPath);
}
function ignoredPath(source) {
  const basename = path.basename(source);
  return ![
    ".git",
    ".wrangler",
    "node_modules",
    "bun.lock",
    "bun.lockb",
    "package-lock.json",
    "pnpm-lock.yaml",
    "worker-configuration.d.ts",
    "yarn.lock"
  ].includes(basename);
}
async function copyDirectory(sourceDir, targetDir) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!ignoredPath(entry.name))
      continue;
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
    }
  }
}
function slugify(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

// scripts/skill.ts
import { existsSync as existsSync2 } from "fs";
import { copyFile as copyFile2, mkdir as mkdir2, readdir as readdir2 } from "fs/promises";
import path2 from "path";
var repoRoot2 = path2.resolve(new URL("..", import.meta.url).pathname);
var skillTemplatesDir = path2.join(repoRoot2, "skill-templates");
var defaultSkill = "deploy-cloudflare";
if (false) {}
async function runSkill(args, context = {}) {
  const commandName = context.commandName ?? "cloudflare-devkit skill";
  const options = parseArgs2(args, commandName);
  const sourceDir = await resolveSkill(options.skill);
  const projectDir = path2.resolve(process.cwd(), options.projectDir);
  const destinationDir = path2.join(projectDir, ".agents", "skills", options.skill);
  if (existsSync2(destinationDir) && !options.force) {
    console.error(`Skill already exists: ${destinationDir}`);
    console.error("Pass --force to overwrite files in that skill directory.");
    process.exit(1);
  }
  await copyDirectory2(sourceDir, destinationDir);
  console.log(`Installed ${options.skill} skill at ${destinationDir}`);
}
function parseArgs2(args, commandName) {
  const parsed = {
    skill: defaultSkill,
    projectDir: ".",
    force: false
  };
  const positionals = [];
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      printUsage2(commandName);
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
function printUsage2(commandName) {
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
async function resolveSkill(skill) {
  const sourceDir = path2.join(skillTemplatesDir, skill);
  if (existsSync2(path2.join(sourceDir, "SKILL.md"))) {
    return sourceDir;
  }
  const skills = await listSkills();
  console.error(`Unknown skill template: ${skill}`);
  if (skills.length > 0) {
    console.error(`Available skills: ${skills.join(", ")}`);
  }
  process.exit(1);
}
function isKnownSkill(value) {
  return existsSync2(path2.join(skillTemplatesDir, value, "SKILL.md"));
}
async function listSkills() {
  if (!existsSync2(skillTemplatesDir))
    return [];
  return (await readdir2(skillTemplatesDir, { withFileTypes: true })).filter((entry) => entry.isDirectory() && existsSync2(path2.join(skillTemplatesDir, entry.name, "SKILL.md"))).map((entry) => entry.name).sort();
}
async function copyDirectory2(sourceDir, targetDir) {
  await mkdir2(targetDir, { recursive: true });
  const entries = await readdir2(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path2.join(sourceDir, entry.name);
    const targetPath = path2.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory2(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await copyFile2(sourcePath, targetPath);
    }
  }
}

// scripts/workflow.ts
import { existsSync as existsSync3 } from "fs";
import { mkdir as mkdir3, readdir as readdir3, readFile as readFile2, writeFile as writeFile2 } from "fs/promises";
import path3 from "path";
var repoRoot3 = path3.resolve(new URL("..", import.meta.url).pathname);
var workflowTemplatesDir = path3.join(repoRoot3, "workflow-templates");
if (false) {}
async function runWorkflow(args, context = {}) {
  const commandName = context.commandName ?? "cloudflare-devkit workflow";
  const options = parseArgs3(args, commandName);
  if (!options.template) {
    printUsage3(commandName);
    process.exit(1);
  }
  const templateName = await resolveTemplate(options.template);
  const destinationPath = path3.resolve(process.cwd(), options.destination ?? defaultDestination(templateName));
  const workflow = await renderWorkflow(templateName, options, destinationPath);
  if (options.print) {
    process.stdout.write(workflow);
    return;
  }
  if (existsSync3(destinationPath) && !options.force) {
    console.error(`Destination already exists: ${destinationPath}`);
    console.error("Pass --force to overwrite it.");
    process.exit(1);
  }
  await mkdir3(path3.dirname(destinationPath), { recursive: true });
  await writeFile2(destinationPath, workflow);
  console.log(`Generated ${templateName} workflow at ${destinationPath}`);
}
function parseArgs3(args, commandName) {
  const parsed = {
    name: "deploy",
    branch: "main",
    target: ".",
    apiTokenSecret: "CLOUDFLARE_API_TOKEN",
    accountIdSecret: "CLOUDFLARE_ACCOUNT_ID",
    force: false,
    print: false
  };
  const positionals = [];
  for (let index = 0;index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      printUsage3(commandName);
      process.exit(0);
    }
    if (arg === "--force") {
      parsed.force = true;
      continue;
    }
    if (arg === "--print") {
      parsed.print = true;
      continue;
    }
    if (arg === "--name") {
      parsed.name = readOptionValue2(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--branch") {
      parsed.branch = readOptionValue2(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--target") {
      parsed.target = readOptionValue2(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--environment") {
      parsed.environment = readOptionValue2(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--api-token-secret") {
      parsed.apiTokenSecret = readOptionValue2(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--account-id-secret") {
      parsed.accountIdSecret = readOptionValue2(args, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
    positionals.push(arg);
  }
  [parsed.template, parsed.destination] = positionals;
  if (positionals.length > 2) {
    console.error(`Unexpected argument: ${positionals[2]}`);
    process.exit(1);
  }
  return parsed;
}
function readOptionValue2(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`${option} requires a value.`);
    process.exit(1);
  }
  return value;
}
function printUsage3(commandName) {
  console.error(`Usage: ${commandName} <template> [destination] [options]`);
  console.error("");
  console.error("Examples:");
  console.error(`  ${commandName} cloudflare-worker`);
  console.error(`  ${commandName} cloudflare-worker .github/workflows/deploy.yml`);
  console.error(`  ${commandName} cloudflare-worker --target apps/api --name deploy-api`);
  console.error(`  ${commandName} cloudflare-worker --target apps/api --environment production --print`);
  console.error("");
  console.error("Options:");
  console.error("  --name <workflow-name>         Workflow display name; defaults to deploy");
  console.error("  --branch <branch>              Push branch; defaults to main");
  console.error("  --target <directory>           Worker project directory; defaults to .");
  console.error("  --environment <name>           GitHub environment name");
  console.error("  --api-token-secret <name>      API token secret; defaults to CLOUDFLARE_API_TOKEN");
  console.error("  --account-id-secret <name>     Account ID secret; defaults to CLOUDFLARE_ACCOUNT_ID");
  console.error("  --print                        Print the workflow instead of writing it");
  console.error("  --force                        Overwrite the destination if it exists");
  console.error("");
  console.error("Templates:");
  console.error("  cloudflare-worker");
}
async function resolveTemplate(template) {
  const templateName = template.replace(/\.ya?ml$/, "");
  const fileName = `${templateName}.yml`;
  const templatePath = path3.join(workflowTemplatesDir, fileName);
  if (existsSync3(templatePath)) {
    return templateName;
  }
  const templates = await listTemplates();
  console.error(`Unknown workflow template: ${template}`);
  if (templates.length > 0) {
    console.error(`Available templates: ${templates.join(", ")}`);
  }
  process.exit(1);
}
async function renderWorkflow(templateName, options, destinationPath) {
  if (templateName === "cloudflare-worker") {
    return renderCloudflareWorkerWorkflow(options, destinationPath);
  }
  const templatePath = path3.join(workflowTemplatesDir, `${templateName}.yml`);
  return readFile2(templatePath, "utf8");
}
function renderCloudflareWorkerWorkflow(options, destinationPath) {
  const target = normalizeTarget(options.target);
  const usesTargetDirectory = target !== ".";
  const workflowPath = workflowTriggerPath(destinationPath);
  const lines = [];
  lines.push(`name: ${yamlString(options.name)}`);
  lines.push("");
  lines.push("on:");
  lines.push("  push:");
  lines.push(`    branches: [${yamlString(options.branch)}]`);
  if (usesTargetDirectory) {
    lines.push("    paths:");
    lines.push(`      - ${yamlString(`${target}/**`)}`);
    lines.push(`      - ${yamlString(workflowPath)}`);
  }
  lines.push("  workflow_dispatch:");
  lines.push("");
  lines.push("jobs:");
  lines.push("  deploy:");
  lines.push("    runs-on: ubuntu-latest");
  if (options.environment) {
    lines.push(`    environment: ${yamlString(options.environment)}`);
  }
  lines.push("    steps:");
  lines.push("      - uses: actions/checkout@v4");
  lines.push("      - uses: oven-sh/setup-bun@v2");
  lines.push("      - name: Install dependencies");
  if (usesTargetDirectory) {
    lines.push(`        working-directory: ${yamlString(target)}`);
  }
  lines.push("        run: bun install");
  lines.push("      - name: Generate types");
  if (usesTargetDirectory) {
    lines.push(`        working-directory: ${yamlString(target)}`);
  }
  lines.push("        run: |");
  lines.push('          if [ "$(bun pm pkg get scripts.types)" != "{}" ]; then');
  lines.push("            bun run types");
  lines.push("          else");
  lines.push('            echo "No types script; skipping."');
  lines.push("          fi");
  lines.push("      - name: Dry run");
  lines.push("        uses: cloudflare/wrangler-action@v3");
  lines.push("        with:");
  lines.push(`          apiToken: \${{ secrets.${options.apiTokenSecret} }}`);
  lines.push(`          accountId: \${{ secrets.${options.accountIdSecret} }}`);
  if (usesTargetDirectory) {
    lines.push(`          workingDirectory: ${target}`);
  }
  lines.push("          command: deploy --dry-run");
  lines.push("      - name: Deploy");
  lines.push(`        if: github.ref == 'refs/heads/${options.branch}' && github.event_name == 'push'`);
  lines.push("        uses: cloudflare/wrangler-action@v3");
  lines.push("        with:");
  lines.push(`          apiToken: \${{ secrets.${options.apiTokenSecret} }}`);
  lines.push(`          accountId: \${{ secrets.${options.accountIdSecret} }}`);
  if (usesTargetDirectory) {
    lines.push(`          workingDirectory: ${target}`);
  }
  lines.push("          command: deploy");
  lines.push("");
  return lines.join(`
`);
}
async function listTemplates() {
  if (!existsSync3(workflowTemplatesDir))
    return [];
  return (await readdir3(workflowTemplatesDir, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".yml")).map((entry) => path3.basename(entry.name, ".yml")).sort();
}
function defaultDestination(templateName) {
  if (templateName === "cloudflare-worker") {
    return ".github/workflows/deploy.yml";
  }
  return path3.join(".github", "workflows", `${templateName}.yml`);
}
function normalizeTarget(target) {
  const normalized = target.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
  if (normalized.length === 0 || normalized === ".")
    return ".";
  return normalized.replace(/^\.\//, "");
}
function yamlString(value) {
  return JSON.stringify(value);
}
function workflowTriggerPath(destinationPath) {
  const relativePath = path3.relative(process.cwd(), destinationPath).replace(/\\/g, "/");
  if (relativePath.startsWith("../") || relativePath === "..") {
    return `.github/workflows/${path3.basename(destinationPath)}`;
  }
  return relativePath;
}

// bin/cloudflare-devkit.ts
var [command, ...args] = process.argv.slice(2);
if (!command || command === "--help" || command === "-h") {
  printUsage4();
  process.exit(command ? 0 : 1);
}
switch (command) {
  case "create":
    await runCreate(args, { commandName: "cloudflare-devkit create" });
    break;
  case "workflow":
    await runWorkflow(args, { commandName: "cloudflare-devkit workflow" });
    break;
  case "skill":
    await runSkill(args, { commandName: "cloudflare-devkit skill" });
    break;
  case "list":
    await init_list().then(() => exports_list);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error("");
    printUsage4();
    process.exit(1);
}
function printUsage4() {
  console.error("Usage: cloudflare-devkit <command> [options]");
  console.error("");
  console.error("Commands:");
  console.error("  list       List available recipes and projects");
  console.error("  create     Create a project from a recipe");
  console.error("  workflow   Copy a GitHub Actions workflow template");
  console.error("  skill      Install a consumer skill into .agents/skills");
  console.error("");
  console.error("Examples:");
  console.error("  cloudflare-devkit create hono-api . --name my-api --workflow");
  console.error("  cloudflare-devkit workflow cloudflare-worker");
  console.error("  cloudflare-devkit skill deploy-cloudflare");
}
