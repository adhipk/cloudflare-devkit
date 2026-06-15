import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);

await printTargets("Recipes", path.join(repoRoot, "recipes"));
await printTargets("Projects", path.join(repoRoot, "projects"));

async function printTargets(title: string, dir: string) {
  if (!existsSync(dir)) return;

  const names = (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  console.log(`${title}:`);
  for (const name of names) {
    const packagePath = path.join(dir, name, "package.json");
    const wranglerPath = path.join(dir, name, "wrangler.jsonc");
    const packageName = existsSync(packagePath)
      ? JSON.parse(await readFile(packagePath, "utf8")).name
      : "(missing package.json)";
    const deployable = existsSync(wranglerPath) ? "deployable" : "missing wrangler.jsonc";
    console.log(`- ${name} (${packageName}) ${deployable}`);
  }
  console.log("");
}
