import {
  acquireWorkerLease,
  createImageAssets,
  dequeueGenerationTask,
  getTask,
  markTaskFailed,
  markTaskProcessing,
  markTaskRetry,
  markTaskSuccess,
  releaseWorkerLease,
  recoverPendingGenerationTasks
} from "@/modules/billing/server/platform";
import {
  isObjectStorageConfigured,
  persistImageSourceToObjectStorage
} from "@/modules/assets/server/object-storage";
import { generateOpenAIImages } from "@/modules/providers/server/openai-images";
import { resolveImageWorkflow } from "@/modules/workflow/server/runner";
import type { GenerationTask } from "@/modules/billing/server/platform";
import type { WorkflowJson } from "@/types/workflow";

type WorkerResult = {
  processed: number;
  succeeded: number;
  failed: number;
  retried: number;
  skipped: number;
  recovered: number;
  locked: boolean;
};

function getGenerateNodeData(workflow: WorkflowJson) {
  return workflow.nodes.find((item) => item.type === "imageGenerate")?.data as
    | Record<string, unknown>
    | undefined;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`任务超时，超过 ${Math.round(timeoutMs / 1000)} 秒未完成。`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

async function persistGeneratedImages(input: {
  userId: string;
  taskId: string;
  images: Array<{ imageUrl: string; mimeType: string }>;
}) {
  if (!isObjectStorageConfigured()) {
    return input.images;
  }

  return await Promise.all(
    input.images.map(async (image, index) => {
      try {
        const stored = await persistImageSourceToObjectStorage({
          imageUrlOrDataUrl: image.imageUrl,
          fileName: `${input.taskId}-${index + 1}.png`,
          folder: `users/${input.userId}/generations/${input.taskId}`
        });

        return {
          imageUrl: stored.url,
          mimeType: stored.contentType
        };
      } catch (error) {
        console.error("generated image storage failed; using provider image url", {
          taskId: input.taskId,
          index,
          error
        });

        return image;
      }
    })
  );
}

export async function processGenerationTask(task: GenerationTask) {
  if (task.cancelRequested) {
    await markTaskFailed(task, "任务已取消。");
    return "failed" as const;
  }

  const processingTask = await markTaskProcessing(task);

  try {
    const latestTask = await getTask(task.id);

    if (latestTask?.cancelRequested) {
      await markTaskFailed(processingTask, "任务已取消。");
      return "failed" as const;
    }

    const resolved = resolveImageWorkflow(task.workflow);
    const generation = await withTimeout(
      generateOpenAIImages(resolved),
      task.timeoutMs ?? Number(process.env.IMAGE_TASK_TIMEOUT_MS ?? 180000)
    );
    const persistedImages = await persistGeneratedImages({
      userId: task.userId,
      taskId: task.id,
      images: generation.images
    });
    const firstImage = persistedImages[0];

    if (!firstImage) {
      throw new Error("Image generation returned no images.");
    }

    const successTask = await markTaskSuccess(processingTask, {
      imageUrl: firstImage.imageUrl,
      mimeType: firstImage.mimeType,
      images: persistedImages,
      provider: "openai",
      model: generation.model
    });
    const generateData = getGenerateNodeData(task.workflow);

    await createImageAssets({
      userId: task.userId,
      task: successTask,
      workflow: task.workflow,
      images: persistedImages,
      resultPrompt: resolved.prompt,
      originalPrompt: String(generateData?.prompt ?? resolved.prompt),
      provider: "openai",
      model: generation.model,
      referenceImages: resolved.referenceImages.map((image) => ({
        refName: image.refName,
        imageUrl: image.imageUrl,
        mimeType: image.mimeType
      }))
    });

    return "succeeded" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片生成失败。";
    const latestTask = await getTask(task.id);
    const attemptTask = latestTask ?? processingTask;
    const attempts = attemptTask.attempts ?? processingTask.attempts ?? 1;
    const maxAttempts = attemptTask.maxAttempts ?? 1;

    if (attemptTask.cancelRequested || attempts >= maxAttempts) {
      await markTaskFailed(attemptTask, message);
      return "failed" as const;
    }

    await markTaskRetry(attemptTask, message);
    return "retried" as const;
  }
}

async function processNextTask() {
  const taskId = await dequeueGenerationTask();

  if (!taskId) {
    return "empty" as const;
  }

  const task = await getTask(taskId);

  if (!task || task.status !== "pending") {
    return "skipped" as const;
  }

  return await processGenerationTask(task);
}

export async function runImageTaskWorker() {
  const workerId = `worker_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const leaseSeconds = Number(process.env.IMAGE_WORKER_LEASE_SECONDS ?? 55);
  const locked = await acquireWorkerLease(workerId, leaseSeconds);
  const result: WorkerResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
    skipped: 0,
    recovered: 0,
    locked
  };

  if (!locked) {
    return result;
  }

  try {
    result.recovered = await recoverPendingGenerationTasks();

    const concurrency = Math.max(1, Number(process.env.IMAGE_WORKER_CONCURRENCY ?? 2));
    const batchResults = await Promise.all(
      Array.from({ length: concurrency }, () => processNextTask())
    );

    for (const item of batchResults) {
      if (item === "empty") continue;
      if (item === "skipped") {
        result.skipped += 1;
        continue;
      }

      result.processed += 1;
      if (item === "succeeded") result.succeeded += 1;
      if (item === "failed") result.failed += 1;
      if (item === "retried") result.retried += 1;
    }
  } finally {
    await releaseWorkerLease();
  }

  return result;
}
