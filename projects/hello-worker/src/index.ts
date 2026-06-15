import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    ok: true,
    service: "hello-worker",
    message: "Hello from Cloudflare Workers",
  });
});

app.get("/health", (c) => c.json({ ok: true }));

export default app;
