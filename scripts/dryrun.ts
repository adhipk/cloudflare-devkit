import path from "node:path";

const [, , target] = process.argv;

if (!target) {
  console.error("Usage: bun run dryrun <recipe-or-project-path>");
  process.exit(1);
}

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const proc = Bun.spawn(["bun", "scripts/deploy.ts", target, "deploy", "--dry-run"], {
  cwd: repoRoot,
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

const exitCode = await proc.exited;
process.exit(exitCode);
