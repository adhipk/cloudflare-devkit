import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.json({ ok: true, service: "__PROJECT_NAME__", type: "d1" }));
app.get("/health", (c) => c.json({ ok: true }));

export default app;
