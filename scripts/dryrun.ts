import { existsSync } from "node:fs";
import path from "node:path";

const [, , projectName, outputRoot = "projects"] = process.argv;

if (!projectName) {
  console.error("Usage: bun run dryrun <project-name> [output-root]");
  process.exit(1);
}

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const projectDir = path.join(repoRoot, outputRoot, projectName);
const configPath = path.join(projectDir, "wrangler.jsonc");

if (!existsSync(configPath)) {
  console.error(`Missing wrangler.jsonc: ${configPath}`);
  process.exit(1);
}

const proc = Bun.spawn(["bunx", "wrangler", "deploy", "--dry-run", "--config", configPath], {
  cwd: projectDir,
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

const exitCode = await proc.exited;
process.exit(exitCode);
