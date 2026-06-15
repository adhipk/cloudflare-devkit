type Endpoint = {
  label: string;
  url: string;
};

type CurlResult = {
  endpoint: Endpoint;
  exitCode: number;
  status: number | null;
  body: string;
  stderr: string;
};

const endpoints: Endpoint[] = [
  { label: "static", url: "https://static.adhipk.dev/" },
  { label: "api", url: "https://api.adhipk.dev/" },
  { label: "api health", url: "https://api.adhipk.dev/health" },
  { label: "d1", url: "https://d1.adhipk.dev/" },
  { label: "d1 health", url: "https://d1.adhipk.dev/health" },
  { label: "r2", url: "https://r2.adhipk.dev/" },
  { label: "r2 health", url: "https://r2.adhipk.dev/health" },
  { label: "cron", url: "https://cron.adhipk.dev/" },
];

const results = await Promise.all(endpoints.map(curlEndpoint));
const failures = results.filter((result) => result.exitCode !== 0 || !isOkStatus(result.status));

for (const result of results) {
  const status = result.status ?? "curl-failed";
  const prefix = failures.includes(result) ? "FAIL" : "OK";
  console.log(`${prefix} ${result.endpoint.label}: ${status} ${result.endpoint.url}`);
}

if (failures.length > 0) {
  console.error("\nErrors:");
  for (const failure of failures) {
    console.error(`- ${failure.endpoint.label} (${failure.endpoint.url})`);
    if (failure.status !== null) {
      console.error(`  HTTP status: ${failure.status}`);
    }
    if (failure.stderr.trim().length > 0) {
      console.error(`  curl: ${failure.stderr.trim()}`);
    }
    if (failure.body.trim().length > 0) {
      console.error(`  body: ${truncate(failure.body.trim(), 300)}`);
    }
  }
  process.exit(1);
}

console.log(`\nChecked ${endpoints.length} deployed endpoint(s).`);

async function curlEndpoint(endpoint: Endpoint): Promise<CurlResult> {
  const proc = Bun.spawn(
    [
      "curl",
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "15",
      "--write-out",
      "\n%{http_code}",
      endpoint.url,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const { body, status } = splitCurlOutput(stdout);

  return {
    endpoint,
    exitCode,
    status,
    body,
    stderr,
  };
}

function splitCurlOutput(stdout: string) {
  const lastNewline = stdout.lastIndexOf("\n");
  if (lastNewline === -1) {
    return { body: stdout, status: null };
  }

  const body = stdout.slice(0, lastNewline);
  const statusText = stdout.slice(lastNewline + 1).trim();
  const status = /^\d{3}$/.test(statusText) ? Number(statusText) : null;
  return { body, status };
}

function isOkStatus(status: number | null) {
  return status !== null && status >= 200 && status < 300;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
