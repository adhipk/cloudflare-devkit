import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const recipesDir = path.join(repoRoot, "recipes");
const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "cloudflare-devkit-"));

const recipeNames = process.argv.slice(2);
const recipes = recipeNames.length > 0 ? recipeNames : await listDirectories(recipesDir);

try {
  for (const recipe of recipes) {
    await validateRecipe(recipe);
  }

  console.log(`Validated ${recipes.length} recipe(s).`);
} finally {
  await rm(tmpRoot, { recursive: true, force: true });
}

async function validateRecipe(recipe: string) {
  const recipeDir = path.join(recipesDir, recipe);
  if (!existsSync(recipeDir)) throw new Error(`Missing recipe: ${recipe}`);

  const projectDir = path.join(tmpRoot, recipe);
  await copyDirectory(recipeDir, projectDir);

  await assertExists(path.join(projectDir, "package.json"), `${recipe} package.json`);
  await assertExists(path.join(projectDir, "wrangler.jsonc"), `${recipe} wrangler.jsonc`);

  await assertNoTemplateTokens(projectDir, recipe);

  await run(["bun", "install"], projectDir, `Dependency install failed for ${recipe}`);

  await run(
    ["bunx", "wrangler", "deploy", "--dry-run", "--config", "wrangler.jsonc"],
    projectDir,
    `Wrangler dry-run failed for ${recipe}`,
  );

  console.log(`ok ${recipe}`);
}

async function listDirectories(dir: string) {
  return (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function assertExists(filePath: string, label: string) {
  try {
    await stat(filePath);
  } catch {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
}

async function assertNoTemplateTokens(dir: string, recipe: string) {
  const files = await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: dir, onlyFiles: true }));
  for (const file of files) {
    if (file.includes("node_modules/")) continue;
    const filePath = path.join(dir, file);
    const content = await Bun.file(filePath).text();
    if (content.includes("__PROJECT_NAME__") || content.includes("__WORKER_NAME__")) {
      throw new Error(`${recipe} contains unreplaced template tokens in ${file}`);
    }
  }
}

async function run(command: string[], cwd: string, label: string) {
  const proc = Bun.spawn(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`${label}:\n${stdout}\n${stderr}`);
  }
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
