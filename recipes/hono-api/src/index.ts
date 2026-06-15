import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    ok: true,
    service: "__PROJECT_NAME__",
  });
});

app.get("/health", (c) => c.json({ ok: true }));

export default app;
