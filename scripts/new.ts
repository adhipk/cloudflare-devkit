import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const [, , recipeName, projectName, outputRoot = "projects"] = process.argv;

if (!recipeName || !projectName) {
  console.error("Usage: bun run new <recipe> <project-name> [output-root]");
  process.exit(1);
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(projectName)) {
  console.error("Project name must be lowercase kebab-case, like my-api.");
  process.exit(1);
}

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const recipeDir = path.join(repoRoot, "recipes", recipeName);
const targetDir = path.join(repoRoot, outputRoot, projectName);

if (!existsSync(recipeDir)) {
  const recipes = await readdir(path.join(repoRoot, "recipes"));
  console.error(`Unknown recipe: ${recipeName}\n`);
  console.error("Available recipes:");
  for (const recipe of recipes.sort()) console.error(`  ${recipe}`);
  process.exit(1);
}

if (existsSync(targetDir)) {
  console.error(`Target already exists: ${targetDir}`);
  process.exit(1);
}

await mkdir(path.dirname(targetDir), { recursive: true });
await cp(recipeDir, targetDir, { recursive: true });
await replaceTokens(targetDir, {
  __PROJECT_NAME__: projectName,
  __WORKER_NAME__: projectName,
});

console.log(`Created ${projectName} from ${recipeName}`);
console.log(`\nNext:`);
console.log(`  cd ${path.relative(repoRoot, targetDir)}`);
console.log("  bun install");
console.log("  bun run dev");

async function replaceTokens(dir: string, tokens: Record<string, string>) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await replaceTokens(fullPath, tokens);
      continue;
    }

    const text = await readFile(fullPath, "utf8").catch(() => null);
    if (text === null) continue;

    let next = text;
    for (const [token, value] of Object.entries(tokens)) {
      next = next.replaceAll(token, value);
    }

    if (next !== text) await writeFile(fullPath, next);
  }
}
