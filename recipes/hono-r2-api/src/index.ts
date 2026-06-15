import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.json({ ok: true, service: "__PROJECT_NAME__", type: "r2" }));
app.get("/health", (c) => c.json({ ok: true }));

export default app;
