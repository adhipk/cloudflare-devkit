#!/usr/bin/env bun
// @bun
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// scripts/list.ts
var exports_list = {};
import { existsSync as existsSync3 } from "fs";
import { readdir as readdir3, readFile as readFile2 } from "fs/promises";
import path3 from "path";
async function printTargets(title, dir) {
  if (!existsSync3(dir))
    return;
  const names = (await readdir3(dir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  console.log(`${title}:`);
  for (const name of names) {
    const packagePath = path3.join(dir, name, "package.json");
    const wranglerPath = path3.join(dir, name, "wrangler.jsonc");
    const packageName = existsSync3(packagePath) ? JSON.parse(await readFile2(packagePath, "utf8")).name : "(missing package.json)";
    const deployable = existsSync3(wranglerPath) ? "deployable" : "missing wrangler.jsonc";
    console.log(`- ${name} (${packageName}) ${deployable}`);
  }
  console.log("");
}
var repoRoot3;
var init_list = __esm(async () => {
  repoRoot3 = path3.resolve(new URL("..", import.meta.url).pathname);
  await printTargets("Recipes", path3.join(repoRoot3, "recipes"));
  await printTargets("Projects", path3.join(repoRoot3, "projects"));
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

// scripts/workflow.ts
import { existsSync as existsSync2 } from "fs";
import { copyFile as copyFile2, mkdir as mkdir2, readdir as readdir2 } from "fs/promises";
import path2 from "path";
var repoRoot2 = path2.resolve(new URL("..", import.meta.url).pathname);
var workflowTemplatesDir = path2.join(repoRoot2, "workflow-templates");
if (false) {}
async function runWorkflow(args, context = {}) {
  const commandName = context.commandName ?? "cloudflare-devkit workflow";
  const options = parseArgs2(args, commandName);
  if (!options.template) {
    printUsage2(commandName);
    process.exit(1);
  }
  const templatePath = await resolveTemplate(options.template);
  const destinationPath = path2.resolve(process.cwd(), options.destination ?? defaultDestination(templatePath));
  if (existsSync2(destinationPath) && !options.force) {
    console.error(`Destination already exists: ${destinationPath}`);
    console.error("Pass --force to overwrite it.");
    process.exit(1);
  }
  await mkdir2(path2.dirname(destinationPath), { recursive: true });
  await copyFile2(templatePath, destinationPath);
  console.log(`Copied ${path2.relative(repoRoot2, templatePath)} to ${destinationPath}`);
}
function parseArgs2(args, commandName) {
  const parsed = { force: false };
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
  [parsed.template, parsed.destination] = positionals;
  if (positionals.length > 2) {
    console.error(`Unexpected argument: ${positionals[2]}`);
    process.exit(1);
  }
  return parsed;
}
function printUsage2(commandName) {
  console.error(`Usage: ${commandName} <template> [destination] [--force]`);
  console.error("");
  console.error("Examples:");
  console.error(`  ${commandName} cloudflare-worker`);
  console.error(`  ${commandName} cloudflare-worker .github/workflows/deploy.yml`);
  console.error(`  ${commandName} cloudflare-worker .github/workflows/deploy.yml --force`);
  console.error("");
  console.error("Templates:");
  console.error("  cloudflare-worker");
}
async function resolveTemplate(template) {
  const fileName = template.endsWith(".yml") ? template : `${template}.yml`;
  const templatePath = path2.join(workflowTemplatesDir, fileName);
  if (existsSync2(templatePath)) {
    return templatePath;
  }
  const templates = await listTemplates();
  console.error(`Unknown workflow template: ${template}`);
  if (templates.length > 0) {
    console.error(`Available templates: ${templates.join(", ")}`);
  }
  process.exit(1);
}
async function listTemplates() {
  if (!existsSync2(workflowTemplatesDir))
    return [];
  return (await readdir2(workflowTemplatesDir, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".yml")).map((entry) => path2.basename(entry.name, ".yml")).sort();
}
function defaultDestination(templatePath) {
  if (path2.basename(templatePath) === "cloudflare-worker.yml") {
    return ".github/workflows/deploy.yml";
  }
  return path2.join(".github", "workflows", path2.basename(templatePath));
}

// bin/cloudflare-devkit.ts
var [command, ...args] = process.argv.slice(2);
if (!command || command === "--help" || command === "-h") {
  printUsage3();
  process.exit(command ? 0 : 1);
}
switch (command) {
  case "create":
    await runCreate(args, { commandName: "cloudflare-devkit create" });
    break;
  case "workflow":
    await runWorkflow(args, { commandName: "cloudflare-devkit workflow" });
    break;
  case "list":
    await init_list().then(() => exports_list);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error("");
    printUsage3();
    process.exit(1);
}
function printUsage3() {
  console.error("Usage: cloudflare-devkit <command> [options]");
  console.error("");
  console.error("Commands:");
  console.error("  list       List available recipes and projects");
  console.error("  create     Create a project from a recipe");
  console.error("  workflow   Copy a GitHub Actions workflow template");
  console.error("");
  console.error("Examples:");
  console.error("  cloudflare-devkit create hono-api . --name my-api --workflow");
  console.error("  cloudflare-devkit workflow cloudflare-worker");
}
