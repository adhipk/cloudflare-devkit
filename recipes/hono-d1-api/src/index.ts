import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.json({ ok: true, service: "hono-d1-api", type: "d1" }));
app.get("/health", (c) => c.json({ ok: true }));

export default app;
