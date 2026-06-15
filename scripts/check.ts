import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const recipesDir = path.join(repoRoot, "recipes");
const projectsDir = path.join(repoRoot, "projects");

const recipes = await listDirectories(recipesDir);
const projects = existsSync(projectsDir) ? await listDirectories(projectsDir) : [];
const targets = [
  ...recipes.map((name) => ({ kind: "recipe", name, dir: path.join(recipesDir, name) })),
  ...projects.map((name) => ({ kind: "project", name, dir: path.join(projectsDir, name) })),
];

const errors: string[] = [];

for (const target of targets) {
  await checkTarget(target);
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Checked ${recipes.length} recipe(s) and ${projects.length} project(s).`);

async function listDirectories(dir: string) {
  return (await readdir(dir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
}

async function checkTarget(target: { kind: string; name: string; dir: string }) {
  const label = `${target.kind}/${target.name}`;
  const dir = target.dir;
  const packagePath = path.join(dir, "package.json");
  const wranglerPath = path.join(dir, "wrangler.jsonc");

  if (!existsSync(packagePath)) {
    errors.push(`${label}: missing package.json`);
  }

  if (existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
      if (typeof packageJson.name !== "string" || packageJson.name.includes("__")) {
        errors.push(`${label}: package.json needs a concrete package name`);
      }
      if (!packageJson.scripts?.deploy) {
        errors.push(`${label}: package.json missing scripts.deploy`);
      }
    } catch (error) {
      errors.push(`${label}: invalid package.json (${String(error)})`);
    }
  }

  if (!existsSync(wranglerPath)) {
    errors.push(`${label}: missing wrangler.jsonc`);
  }

  if (existsSync(wranglerPath)) {
    const wrangler = await readFile(wranglerPath, "utf8");
    if (wrangler.includes("__")) {
      errors.push(`${label}: wrangler.jsonc contains unreplaced template tokens`);
    }
    if (!wrangler.includes("compatibility_date")) {
      errors.push(`${label}: wrangler.jsonc missing compatibility_date`);
    }

    try {
      const config = JSON.parse(wrangler);
      if (typeof config.name !== "string" || config.name.length === 0) {
        errors.push(`${label}: wrangler.jsonc missing name`);
      }
      if (typeof config.main === "string") {
        await assertExists(path.join(dir, config.main), `${label}: missing main entry`);
      }
      if (config.assets?.directory) {
        await assertExists(path.join(dir, config.assets.directory), `${label}: missing assets directory`);
      }
      if (!config.main && !config.assets?.directory) {
        errors.push(`${label}: wrangler.jsonc needs either main or assets.directory`);
      }
    } catch (error) {
      errors.push(`${label}: invalid wrangler.jsonc (${String(error)})`);
    }
  }
}

async function assertExists(filePath: string, message: string) {
  try {
    await stat(filePath);
  } catch {
    errors.push(`${message}: ${filePath}`);
  }
}
