import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const workflowTemplatesDir = path.join(repoRoot, "workflow-templates");

type WorkflowOptions = {
  template?: string;
  destination?: string;
  force: boolean;
};

if (import.meta.main) {
  await runWorkflow(process.argv.slice(2), { commandName: "bun run workflow" });
}

export async function runWorkflow(args: string[], context: { commandName?: string } = {}) {
  const commandName = context.commandName ?? "cloudflare-devkit workflow";
  const options = parseArgs(args, commandName);

  if (!options.template) {
    printUsage(commandName);
    process.exit(1);
  }

  const templatePath = await resolveTemplate(options.template);
  const destinationPath = path.resolve(process.cwd(), options.destination ?? defaultDestination(templatePath));

  if (existsSync(destinationPath) && !options.force) {
    console.error(`Destination already exists: ${destinationPath}`);
    console.error("Pass --force to overwrite it.");
    process.exit(1);
  }

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(templatePath, destinationPath);

  console.log(`Copied ${path.relative(repoRoot, templatePath)} to ${destinationPath}`);
}

function parseArgs(args: string[], commandName: string): WorkflowOptions {
  const parsed: WorkflowOptions = { force: false };
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

  [parsed.template, parsed.destination] = positionals;

  if (positionals.length > 2) {
    console.error(`Unexpected argument: ${positionals[2]}`);
    process.exit(1);
  }

  return parsed;
}

function printUsage(commandName: string) {
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

async function resolveTemplate(template: string) {
  const fileName = template.endsWith(".yml") ? template : `${template}.yml`;
  const templatePath = path.join(workflowTemplatesDir, fileName);

  if (existsSync(templatePath)) {
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
  if (!existsSync(workflowTemplatesDir)) return [];

  return (await readdir(workflowTemplatesDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yml"))
    .map((entry) => path.basename(entry.name, ".yml"))
    .sort();
}

function defaultDestination(templatePath: string) {
  if (path.basename(templatePath) === "cloudflare-worker.yml") {
    return ".github/workflows/deploy.yml";
  }

  return path.join(".github", "workflows", path.basename(templatePath));
}
