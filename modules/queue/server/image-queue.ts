import { Queue } from "bullmq";

import { getBullMQConnection, isBullMQConfigured } from "@/modules/queue/server/bullmq-connection";

export type ImageGenerationJobData = {
  taskId: string;
};

let imageQueue: Queue<ImageGenerationJobData> | undefined;

export function getImageQueueName() {
  return process.env.IMAGE_QUEUE_NAME ?? "image-generation";
}

export function canUseBullMQQueue() {
  return isBullMQConfigured();
}

export function getImageQueue() {
  if (!imageQueue) {
    imageQueue = new Queue<ImageGenerationJobData>(getImageQueueName(), {
      connection: getBullMQConnection(),
      defaultJobOptions: {
        removeOnComplete: {
          age: 60 * 60 * 24,
          count: 1000
        },
        removeOnFail: {
          age: 60 * 60 * 24 * 7,
          count: 2000
        }
      }
    });
  }

  return imageQueue;
}

export async function enqueueImageGenerationJob(taskId: string) {
  if (!canUseBullMQQueue()) {
    return false;
  }

  const queue = getImageQueue();

  await queue.add(
    "generate-image",
    { taskId },
    {
      jobId: taskId,
      attempts: 1
    }
  );

  return true;
}

export async function closeImageQueue() {
  if (!imageQueue) return;

  await imageQueue.close();
  imageQueue = undefined;
}
