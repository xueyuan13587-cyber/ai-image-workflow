import { closeBullMQConnection } from "@/modules/queue/server/bullmq-connection";
import { closeImageQueue } from "@/modules/queue/server/image-queue";
import { startBullMQImageWorker } from "@/modules/queue/server/bullmq-image-worker";

async function main() {
  const worker = await startBullMQImageWorker();

  console.info("Image worker started.");

  const shutdown = async (signal: string) => {
    console.info(`Received ${signal}. Closing image worker...`);
    await worker.close();
    await closeImageQueue();
    await closeBullMQConnection();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((error) => {
  console.error("Image worker crashed", error);
  process.exit(1);
});
