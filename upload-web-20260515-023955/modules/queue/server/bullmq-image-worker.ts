import { Worker } from "bullmq";

import { getBullMQConnection, isBullMQConfigured } from "@/modules/queue/server/bullmq-connection";
import { getImageQueueName, type ImageGenerationJobData } from "@/modules/queue/server/image-queue";
import { getTask, recoverPendingGenerationTasks } from "@/modules/billing/server/platform";
import { processGenerationTask } from "@/modules/queue/server/image-task-worker";

export type BullMQImageWorkerHandle = {
  close: () => Promise<void>;
};

export async function startBullMQImageWorker(): Promise<BullMQImageWorkerHandle> {
  if (!isBullMQConfigured()) {
    throw new Error("REDIS_URL is not configured. Cannot start BullMQ image worker.");
  }

  const recovered = await recoverPendingGenerationTasks();

  if (recovered > 0) {
    console.info(`Recovered ${recovered} pending image task(s).`);
  }

  const worker = new Worker<ImageGenerationJobData>(
    getImageQueueName(),
    async (job) => {
      const task = await getTask(job.data.taskId);

      if (!task) {
        console.warn(`Skipped missing image task ${job.data.taskId}.`);
        return "skipped";
      }

      if (task.status !== "pending") {
        console.warn(`Skipped image task ${job.data.taskId} with status ${task.status}.`);
        return "skipped";
      }

      return await processGenerationTask(task);
    },
    {
      connection: getBullMQConnection(),
      concurrency: Math.max(1, Number(process.env.IMAGE_WORKER_CONCURRENCY ?? 2)),
      lockDuration: Number(process.env.IMAGE_TASK_TIMEOUT_MS ?? 180000) + 30000
    }
  );

  worker.on("completed", (job, result) => {
    console.info(`Image job ${job.id} completed: ${result}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Image job ${job?.id ?? "unknown"} failed`, error);
  });

  worker.on("error", (error) => {
    console.error("BullMQ image worker error", error);
  });

  return {
    close: async () => {
      await worker.close();
    }
  };
}
