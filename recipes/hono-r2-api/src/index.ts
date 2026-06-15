import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.json({ ok: true, service: "hono-r2-api", type: "r2" }));
app.get("/health", (c) => c.json({ ok: true }));

export default app;
