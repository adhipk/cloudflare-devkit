import { Hono } from "hono";

type Env = {
  Bindings: {
    DB: D1Database;
  };
};

const app = new Hono<Env>();

app.get("/", (c) => c.json({ ok: true, service: "__PROJECT_NAME__" }));

app.get("/notes", async (c) => {
  const { results } = await c.env.DB.prepare(
    "select id, body, created_at from notes order by created_at desc limit 50",
  ).all();

  return c.json({ notes: results });
});

app.post("/notes", async (c) => {
  const { body } = await c.req.json<{ body?: string }>();

  if (!body) return c.json({ error: "body is required" }, 400);

  const id = crypto.randomUUID();
  await c.env.DB.prepare("insert into notes (id, body) values (?, ?)")
    .bind(id, body)
    .run();

  return c.json({ id, body }, 201);
});

export default app;
