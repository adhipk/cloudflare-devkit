import { mkdtemp, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const recipesDir = path.join(repoRoot, "recipes");
const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "cloudflare-devkit-"));

const recipeNames = process.argv.slice(2);
const recipes = recipeNames.length > 0 ? recipeNames : await listRecipes();

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

  const projectName = `test-${recipe}`.replaceAll("_", "-");
  const proc = Bun.spawn(["bun", "scripts/new.ts", recipe, projectName, tmpRoot], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to scaffold ${recipe}:\n${stderr}`);
  }

  const projectDir = path.join(tmpRoot, projectName);
  await assertExists(path.join(projectDir, "package.json"), `${recipe} package.json`);

  const hasWranglerConfig = existsSync(path.join(projectDir, "wrangler.jsonc"));
  const isPlaceholder = recipe === "astro-blog";

  if (!hasWranglerConfig && !isPlaceholder) {
    throw new Error(`${recipe} is missing wrangler.jsonc`);
  }

  if (hasWranglerConfig) {
    const dryRun = Bun.spawn(["bunx", "wrangler", "deploy", "--dry-run", "--config", "wrangler.jsonc"], {
      cwd: projectDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const dryRunExitCode = await dryRun.exited;
    if (dryRunExitCode !== 0) {
      const stdout = await new Response(dryRun.stdout).text();
      const stderr = await new Response(dryRun.stderr).text();
      throw new Error(`Wrangler dry-run failed for ${recipe}:\n${stdout}\n${stderr}`);
    }
  }

  console.log(`ok ${recipe}`);
}

async function listRecipes() {
  const entries = await Array.fromAsync(new Bun.Glob("*").scan({ cwd: recipesDir, onlyFiles: false }));
  return entries.sort();
}

async function assertExists(filePath: string, label: string) {
  try {
    await stat(filePath);
  } catch {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
}
