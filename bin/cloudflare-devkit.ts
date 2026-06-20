#!/usr/bin/env bun

import { runCreate } from "../scripts/create.ts";
import { runWorkflow } from "../scripts/workflow.ts";

const [command, ...args] = process.argv.slice(2);

if (!command || command === "--help" || command === "-h") {
  printUsage();
  process.exit(command ? 0 : 1);
}

switch (command) {
  case "create":
    await runCreate(args, { commandName: "cloudflare-devkit create" });
    break;
  case "workflow":
    await runWorkflow(args, { commandName: "cloudflare-devkit workflow" });
    break;
  case "list":
    await import("../scripts/list.ts");
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error("");
    printUsage();
    process.exit(1);
}

function printUsage() {
  console.error("Usage: cloudflare-devkit <command> [options]");
  console.error("");
  console.error("Commands:");
  console.error("  list       List available recipes and projects");
  console.error("  create     Create a project from a recipe");
  console.error("  workflow   Copy a GitHub Actions workflow template");
  console.error("");
  console.error("Examples:");
  console.error("  cloudflare-devkit create hono-api . --name my-api --workflow");
  console.error("  cloudflare-devkit workflow cloudflare-worker");
}
