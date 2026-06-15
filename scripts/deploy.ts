import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const args = process.argv.slice(2);
const target = args.shift();

if (!target) {
  console.error("Usage: bun run deploy <recipe-or-project-path> [wrangler command]");
  console.error("Example: bun run deploy recipes/hono-api deploy --dry-run");
  process.exit(1);
}

const inPlaceIndex = args.indexOf("--in-place");
const inPlace = inPlaceIndex >= 0;
if (inPlace) args.splice(inPlaceIndex, 1);

const targetDir = resolveTarget(target);
const configPath = path.join(targetDir, "wrangler.jsonc");

if (!existsSync(configPath)) {
  console.error(`Missing wrangler.jsonc: ${configPath}`);
  process.exit(1);
}

const command = args.length === 0 ? ["deploy"] : args[0].startsWith("-") ? ["deploy", ...args] : args;
const tmpRoot = inPlace ? undefined : await mkdtemp(path.join(os.tmpdir(), "cloudflare-devkit-deploy-"));
const workDir = inPlace ? targetDir : path.join(tmpRoot!, path.basename(targetDir));

try {
  if (!inPlace) {
    await copyDirectory(targetDir, workDir);
  }

  if (existsSync(path.join(workDir, "package.json"))) {
    await run(["bun", "install"], workDir);
  }

  await run(["bunx", "wrangler", ...command, "--config", "wrangler.jsonc"], workDir);
} finally {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
}

function resolveTarget(target: string) {
  const candidates = [
    path.resolve(repoRoot, target),
    path.join(repoRoot, "recipes", target),
    path.join(repoRoot, "projects", target),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  console.error(`Unknown recipe or project: ${target}`);
  process.exit(1);
}

async function run(command: string[], cwd: string) {
  const proc = Bun.spawn(command, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) process.exit(exitCode);
}

function ignoredPath(source: string) {
  const basename = path.basename(source);
  return basename !== "node_modules" && basename !== ".wrangler" && basename !== ".git";
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
