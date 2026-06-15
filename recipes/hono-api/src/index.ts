import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    ok: true,
    service: "hono-api",
  });
});

app.get("/health", (c) => c.json({ ok: true }));

export default app;
