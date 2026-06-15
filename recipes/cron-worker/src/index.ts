export default {
  async fetch() {
    return Response.json({
      ok: true,
      service: "cron-worker",
      schedule: "*/15 * * * *",
    });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(event));
  },
};

async function handleScheduled(event: ScheduledEvent) {
  console.log(`cron-worker ran at ${new Date(event.scheduledTime).toISOString()}`);
}
