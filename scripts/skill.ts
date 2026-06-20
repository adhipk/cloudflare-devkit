import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const skillTemplatesDir = path.join(repoRoot, "skill-templates");
const defaultSkill = "deploy-cloudflare";

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
  const sourceDir = await resolveSkill(options.skill);
  const projectDir = path.resolve(process.cwd(), options.projectDir);
  const destinationDir = path.join(projectDir, ".agents", "skills", options.skill);

  if (existsSync(destinationDir) && !options.force) {
    console.error(`Skill already exists: ${destinationDir}`);
    console.error("Pass --force to overwrite files in that skill directory.");
    process.exit(1);
  }

  await copyDirectory(sourceDir, destinationDir);

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
    return sourceDir;
  }

  const skills = await listSkills();
  console.error(`Unknown skill template: ${skill}`);
  if (skills.length > 0) {
    console.error(`Available skills: ${skills.join(", ")}`);
  }
  process.exit(1);
}

function isKnownSkill(value: string) {
  return existsSync(path.join(skillTemplatesDir, value, "SKILL.md"));
}

async function listSkills() {
  if (!existsSync(skillTemplatesDir)) return [];

  return (await readdir(skillTemplatesDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && existsSync(path.join(skillTemplatesDir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
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
