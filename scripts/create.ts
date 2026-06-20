import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const recipesDir = path.join(repoRoot, "recipes");
const workflowTemplatePath = path.join(repoRoot, "workflow-templates", "cloudflare-worker.yml");

type CreateOptions = {
  recipe?: string;
  destination?: string;
  name?: string;
  packageName?: string;
  domain?: string;
  workflow: boolean;
};

if (import.meta.main) {
  await runCreate(process.argv.slice(2), { commandName: "bun run create" });
}

export async function runCreate(args: string[], context: { commandName?: string } = {}) {
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

function parseArgs(args: string[], commandName: string): CreateOptions {
  const parsed: CreateOptions = { workflow: false };
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
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

function readOptionValue(args: string[], index: number, option: string) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`${option} requires a value.`);
    process.exit(1);
  }
  return value;
}

function printUsage(commandName: string) {
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
  console.error("  --workflow                  Copy the GitHub Actions caller workflow");
}

function resolveRecipe(recipe: string) {
  const candidates = [
    path.resolve(process.cwd(), recipe),
    path.resolve(repoRoot, recipe),
    path.join(recipesDir, recipe),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "package.json")) && existsSync(path.join(candidate, "wrangler.jsonc"))) {
      return candidate;
    }
  }

  console.error(`Unknown recipe: ${recipe}`);
  process.exit(1);
}

async function assertDestinationAvailable(destinationDir: string) {
  if (!existsSync(destinationDir)) return;

  const entries = await readdir(destinationDir);
  if (entries.length > 0) {
    console.error(`Destination already exists and is not empty: ${destinationDir}`);
    process.exit(1);
  }
}

async function rewritePackageJson(packagePath: string, packageName: string) {
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.name = packageName;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

async function rewriteWranglerConfig(configPath: string, workerName: string, domain?: string) {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.name = workerName;

  if (domain) {
    config.routes = [
      {
        pattern: domain,
        custom_domain: true,
      },
    ];
  } else {
    delete config.routes;
  }

  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

async function copyWorkflow(destinationDir: string) {
  const workflowDir = path.join(destinationDir, ".github", "workflows");
  const workflowPath = path.join(workflowDir, "deploy.yml");

  if (existsSync(workflowPath)) {
    console.error(`Workflow already exists: ${workflowPath}`);
    process.exit(1);
  }

  await mkdir(workflowDir, { recursive: true });
  await copyFile(workflowTemplatePath, workflowPath);
}

function ignoredPath(source: string) {
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
    "yarn.lock",
  ].includes(basename);
}

async function copyDirectory(sourceDir: string, targetDir: string) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!ignoredPath(entry.name)) continue;

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
    }
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
