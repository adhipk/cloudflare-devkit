import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const workflowTemplatesDir = path.join(repoRoot, "workflow-templates");

type WorkflowOptions = {
  template?: string;
  destination?: string;
  name: string;
  branch: string;
  target: string;
  environment?: string;
  apiTokenSecret: string;
  accountIdSecret: string;
  force: boolean;
  print: boolean;
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

  const templateName = await resolveTemplate(options.template);
  const destinationPath = path.resolve(process.cwd(), options.destination ?? defaultDestination(templateName));
  const workflow = await renderWorkflow(templateName, options, destinationPath);

  if (options.print) {
    process.stdout.write(workflow);
    return;
  }

  if (existsSync(destinationPath) && !options.force) {
    console.error(`Destination already exists: ${destinationPath}`);
    console.error("Pass --force to overwrite it.");
    process.exit(1);
  }

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await writeFile(destinationPath, workflow);

  console.log(`Generated ${templateName} workflow at ${destinationPath}`);
}

function parseArgs(args: string[], commandName: string): WorkflowOptions {
  const parsed: WorkflowOptions = {
    name: "deploy",
    branch: "main",
    target: ".",
    apiTokenSecret: "CLOUDFLARE_API_TOKEN",
    accountIdSecret: "CLOUDFLARE_ACCOUNT_ID",
    force: false,
    print: false,
  };
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      printUsage(commandName);
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
      parsed.name = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--branch") {
      parsed.branch = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--target") {
      parsed.target = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--environment") {
      parsed.environment = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--api-token-secret") {
      parsed.apiTokenSecret = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--account-id-secret") {
      parsed.accountIdSecret = readOptionValue(args, index, arg);
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

function readOptionValue(args: string[], index: number, option: string) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`${option} requires a value.`);
    process.exit(1);
  }
  return value;
}

function printUsage(commandName: string) {
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

async function resolveTemplate(template: string) {
  const templateName = template.replace(/\.ya?ml$/, "");
  const fileName = `${templateName}.yml`;
  const templatePath = path.join(workflowTemplatesDir, fileName);

  if (existsSync(templatePath)) {
    return templateName;
  }

  const templates = await listTemplates();
  console.error(`Unknown workflow template: ${template}`);
  if (templates.length > 0) {
    console.error(`Available templates: ${templates.join(", ")}`);
  }
  process.exit(1);
}

async function renderWorkflow(templateName: string, options: WorkflowOptions, destinationPath: string) {
  if (templateName === "cloudflare-worker") {
    return renderCloudflareWorkerWorkflow(options, destinationPath);
  }

  const templatePath = path.join(workflowTemplatesDir, `${templateName}.yml`);
  return readFile(templatePath, "utf8");
}

function renderCloudflareWorkerWorkflow(options: WorkflowOptions, destinationPath: string) {
  const target = normalizeTarget(options.target);
  const usesTargetDirectory = target !== ".";
  const workflowPath = workflowTriggerPath(destinationPath);
  const lines: string[] = [];

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

  return lines.join("\n");
}

async function listTemplates() {
  if (!existsSync(workflowTemplatesDir)) return [];

  return (await readdir(workflowTemplatesDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yml"))
    .map((entry) => path.basename(entry.name, ".yml"))
    .sort();
}

function defaultDestination(templateName: string) {
  if (templateName === "cloudflare-worker") {
    return ".github/workflows/deploy.yml";
  }

  return path.join(".github", "workflows", `${templateName}.yml`);
}

function normalizeTarget(target: string) {
  const normalized = target.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
  if (normalized.length === 0 || normalized === ".") return ".";
  return normalized.replace(/^\.\//, "");
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

function workflowTriggerPath(destinationPath: string) {
  const relativePath = path.relative(process.cwd(), destinationPath).replace(/\\/g, "/");
  if (relativePath.startsWith("../") || relativePath === "..") {
    return `.github/workflows/${path.basename(destinationPath)}`;
  }
  return relativePath;
}
