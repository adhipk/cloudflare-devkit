import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const recipesDir = path.join(repoRoot, "recipes");
const recipes = (await readdir(recipesDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const errors: string[] = [];

for (const recipe of recipes) {
  const dir = path.join(recipesDir, recipe);
  const packagePath = path.join(dir, "package.json");
  const wranglerPath = path.join(dir, "wrangler.jsonc");

  if (!existsSync(packagePath) && recipe !== "astro-blog") {
    errors.push(`${recipe}: missing package.json`);
  }

  if (existsSync(packagePath)) {
    try {
      JSON.parse(await readFile(packagePath, "utf8"));
    } catch (error) {
      errors.push(`${recipe}: invalid package.json (${String(error)})`);
    }
  }

  if (!existsSync(wranglerPath) && recipe !== "astro-blog") {
    errors.push(`${recipe}: missing wrangler.jsonc`);
  }

  if (existsSync(wranglerPath)) {
    const wrangler = await readFile(wranglerPath, "utf8");
    if (!wrangler.includes("__WORKER_NAME__")) {
      errors.push(`${recipe}: wrangler.jsonc should include __WORKER_NAME__ token`);
    }
    if (!wrangler.includes("compatibility_date")) {
      errors.push(`${recipe}: wrangler.jsonc missing compatibility_date`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Checked ${recipes.length} recipe(s).`);
