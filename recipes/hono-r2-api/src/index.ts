import { Hono } from "hono";

type Env = {
  Bindings: {
    BUCKET: R2Bucket;
  };
};

const app = new Hono<Env>();

app.get("/", (c) => c.json({ ok: true, service: "__PROJECT_NAME__" }));

app.put("/objects/:key", async (c) => {
  const key = c.req.param("key");
  await c.env.BUCKET.put(key, c.req.raw.body);
  return c.json({ key });
});

app.get("/objects/:key", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.BUCKET.get(key);

  if (!object) return c.json({ error: "not found" }, 404);

  return new Response(object.body, {
    headers: {
      "etag": object.httpEtag,
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
    },
  });
});

export default app;
