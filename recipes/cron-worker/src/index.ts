export default {
  async fetch() {
    return Response.json({ ok: true, service: "__PROJECT_NAME__" });
  },

  async scheduled(event: ScheduledEvent, env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(runJob(event));
  },
};

async function runJob(event: ScheduledEvent) {
  console.log("scheduled job fired", {
    cron: event.cron,
    scheduledTime: new Date(event.scheduledTime).toISOString(),
  });
}
