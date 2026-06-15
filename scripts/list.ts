import { readdir } from "node:fs/promises";

const recipesDir = new URL("../recipes/", import.meta.url);

const entries = await readdir(recipesDir, { withFileTypes: true }).catch(() => []);
const recipes = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

if (recipes.length === 0) {
  console.log("No recipes found.");
  process.exit(0);
}

console.log("Available recipes:\n");
for (const recipe of recipes) {
  console.log(`  ${recipe}`);
}
