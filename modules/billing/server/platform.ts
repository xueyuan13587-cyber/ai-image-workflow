import type { ResolvedImageWorkflow } from "@/modules/workflow/server/runner";
import { enqueueImageGenerationJob } from "@/modules/queue/server/image-queue";
import {
  storeGet,
  storeGetNumber,
  storeIncrBy,
  storeListPopRight,
  storeListPush,
  storeListRange,
  storeDelete,
  storeSetNxEx,
  storeSet
} from "@/modules/queue/server/redis-store";
import type { ImageAsset, WorkflowJson } from "@/types/workflow";

export type GenerationFeature =
  | "text-to-image"
  | "image-to-image"
  | "reference-image"
  | "inpaint"
  | "outpaint"
  | "upscale"
  | "multi-image-fusion"
  | "batch";

export type TaskStatus = "pending" | "processing" | "success" | "failed";

export type ModelPricing = {
  id: string;
  name: string;
  enabled: boolean;
  channel: string;
  baseCredits: number;
  multiplier: number;
  resolutionMultipliers?: PricingRules["resolutionMultipliers"];
  detailMultipliers?: PricingRules["detailMultipliers"];
  referenceImageMultiplier?: number;
};

export type ChannelConfig = {
  id: string;
  name: string;
  provider: "gptsapi" | "openai" | "gemini" | "custom";
  baseUrl: string;
  enabled: boolean;
};

export type PricingRules = {
  resolutionMultipliers: Record<"1K" | "2K" | "4K", number>;
  detailMultipliers: Record<"low" | "medium" | "high", number>;
  featureMultipliers: Record<GenerationFeature, number>;
};

export type GenerationTask = {
  id: string;
  userId: string;
  status: TaskStatus;
  feature: GenerationFeature;
  workflow: WorkflowJson;
  prompt: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  detail: string;
  count: number;
  costCredits: number;
  attempts?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  queuedAt?: string;
  cancelRequested?: boolean;
  refundedCredits?: number;
  error?: string;
  result?: {
    imageUrl: string;
    images?: Array<{
      imageUrl: string;
      mimeType: string;
    }>;
    mimeType: string;
    provider: "openai";
    model: string;
  };
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
};

export type PlatformLog = {
  id: string;
  type:
    | "task_created"
    | "task_processing"
    | "task_success"
    | "task_failed"
    | "credits_debited"
    | "credits_refunded"
    | "recharge_created"
    | "recharge_approved"
    | "recharge_rejected"
    | "credits_added";
  userId: string;
  taskId?: string;
  orderId?: string;
  message: string;
  createdAt: string;
};

export type RechargePlan = {
  id: string;
  name: string;
  credits: number;
  priceCny: number;
  bonusCredits?: number;
  enabled: boolean;
  description?: string;
};

export type RechargeOrderStatus = "pending" | "paid" | "rejected";

export type RechargeOrder = {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  credits: number;
  bonusCredits: number;
  totalCredits: number;
  priceCny: number;
  status: RechargeOrderStatus;
  paymentNote?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
};

const DEFAULT_CREDITS = Number(process.env.DEFAULT_USER_CREDITS ?? 100);

const defaultModels: ModelPricing[] = [
  {
    id: "gpt-image-1.5",
    name: "Image 1.5",
    enabled: true,
    channel: "gptsapi-v1",
    baseCredits: 4,
    multiplier: 1,
    referenceImageMultiplier: 1.25,
    resolutionMultipliers: { "1K": 1, "2K": 2, "4K": 4 },
    detailMultipliers: { low: 1, medium: 1.4, high: 2 }
  },
  {
    id: "gpt-image-2-plus",
    name: "Image 2",
    enabled: true,
    channel: "gptsapi-v3-openai",
    baseCredits: 10,
    multiplier: 1,
    referenceImageMultiplier: 1.25,
    resolutionMultipliers: { "1K": 1, "2K": 2, "4K": 4 },
    detailMultipliers: { low: 1, medium: 1.4, high: 2 }
  },
  {
    id: "gemini-3.1-flash-image-preview",
    name: "Banana2",
    enabled: true,
    channel: "gptsapi-v3-google",
    baseCredits: 6,
    multiplier: 1,
    referenceImageMultiplier: 1.25,
    resolutionMultipliers: { "1K": 1, "2K": 2, "4K": 4 },
    detailMultipliers: { low: 1, medium: 1.4, high: 2 }
  },
  {
    id: "gemini-3-pro-image-preview",
    name: "Banana Pro",
    enabled: true,
    channel: "gptsapi-v3-google",
    baseCredits: 12,
    multiplier: 1,
    referenceImageMultiplier: 1.25,
    resolutionMultipliers: { "1K": 1, "2K": 2, "4K": 4 },
    detailMultipliers: { low: 1, medium: 1.4, high: 2 }
  }
];

const defaultChannels: ChannelConfig[] = [
  {
    id: "gptsapi-v1",
    name: "GPTSAPI OpenAI Compatible",
    provider: "gptsapi",
    baseUrl: "https://api.gptsapi.net/v1",
    enabled: true
  },
  {
    id: "gptsapi-v3-openai",
    name: "GPTSAPI OpenAI V3",
    provider: "gptsapi",
    baseUrl: "https://api.gptsapi.net/api/v3/openai",
    enabled: true
  },
  {
    id: "gptsapi-v3-google",
    name: "GPTSAPI Google V3",
    provider: "gptsapi",
    baseUrl: "https://api.gptsapi.net/api/v3/google",
    enabled: true
  }
];

const defaultPricingRules: PricingRules = {
  resolutionMultipliers: {
    "1K": 1,
    "2K": 2,
    "4K": 4
  },
  detailMultipliers: {
    low: 1,
    medium: 1.4,
    high: 2
  },
  featureMultipliers: {
    "text-to-image": 1,
    "image-to-image": 1.25,
    "reference-image": 1.25,
    inpaint: 1.4,
    outpaint: 1.4,
    upscale: 1.5,
    "multi-image-fusion": 1.6,
    batch: 1.2
  }
};

const defaultRechargePlans: RechargePlan[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 100,
    bonusCredits: 0,
    priceCny: 19,
    enabled: true,
    description: "适合轻度体验"
  },
  {
    id: "creator",
    name: "Creator",
    credits: 360,
    bonusCredits: 40,
    priceCny: 59,
    enabled: true,
    description: "适合日常创作"
  },
  {
    id: "studio",
    name: "Studio",
    credits: 900,
    bonusCredits: 150,
    priceCny: 129,
    enabled: true,
    description: "适合批量生成"
  }
];

function toPositiveNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return Math.round(numberValue * 100) / 100;
}

function normalizeModels(models: unknown): ModelPricing[] {
  if (!Array.isArray(models)) {
    return defaultModels;
  }

  return defaultModels.map((fallback) => {
    const stored = models.find(
      (item): item is Partial<ModelPricing> =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        item.id === fallback.id
    );
    const baseCredits = Number(stored?.baseCredits);
    const multiplier = Number(stored?.multiplier);
    const referenceImageMultiplier = Number(stored?.referenceImageMultiplier);
    const resolutionMultipliers = normalizePricingRules({
      resolutionMultipliers: stored?.resolutionMultipliers
    }).resolutionMultipliers;
    const detailMultipliers = normalizePricingRules({
      detailMultipliers: stored?.detailMultipliers
    }).detailMultipliers;

    return {
      ...fallback,
      ...stored,
      enabled: typeof stored?.enabled === "boolean" ? stored.enabled : fallback.enabled,
      baseCredits: Number.isFinite(baseCredits) ? Math.max(1, Math.round(baseCredits)) : fallback.baseCredits,
      multiplier: Number.isFinite(multiplier) && multiplier > 0 ? Math.round(multiplier * 100) / 100 : fallback.multiplier,
      referenceImageMultiplier:
        Number.isFinite(referenceImageMultiplier) && referenceImageMultiplier > 0
          ? Math.round(referenceImageMultiplier * 100) / 100
          : fallback.referenceImageMultiplier,
      resolutionMultipliers,
      detailMultipliers
    };
  });
}

function normalizeChannels(channels: unknown): ChannelConfig[] {
  if (!Array.isArray(channels)) {
    return defaultChannels;
  }

  return defaultChannels.map((fallback) => {
    const stored = channels.find(
      (item): item is Partial<ChannelConfig> =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        item.id === fallback.id
    );

    return {
      ...fallback,
      ...stored,
      enabled: typeof stored?.enabled === "boolean" ? stored.enabled : fallback.enabled
    };
  });
}

function normalizePricingRules(rules: unknown): PricingRules {
  const stored =
    typeof rules === "object" && rules !== null
      ? (rules as Partial<PricingRules>)
      : {};

  return {
    resolutionMultipliers: {
      "1K": toPositiveNumber(
        stored.resolutionMultipliers?.["1K"],
        defaultPricingRules.resolutionMultipliers["1K"]
      ),
      "2K": toPositiveNumber(
        stored.resolutionMultipliers?.["2K"],
        defaultPricingRules.resolutionMultipliers["2K"]
      ),
      "4K": toPositiveNumber(
        stored.resolutionMultipliers?.["4K"],
        defaultPricingRules.resolutionMultipliers["4K"]
      )
    },
    detailMultipliers: {
      low: toPositiveNumber(
        stored.detailMultipliers?.low,
        defaultPricingRules.detailMultipliers.low
      ),
      medium: toPositiveNumber(
        stored.detailMultipliers?.medium,
        defaultPricingRules.detailMultipliers.medium
      ),
      high: toPositiveNumber(
        stored.detailMultipliers?.high,
        defaultPricingRules.detailMultipliers.high
      )
    },
    featureMultipliers: {
      "text-to-image": toPositiveNumber(
        stored.featureMultipliers?.["text-to-image"],
        defaultPricingRules.featureMultipliers["text-to-image"]
      ),
      "image-to-image": toPositiveNumber(
        stored.featureMultipliers?.["image-to-image"],
        defaultPricingRules.featureMultipliers["image-to-image"]
      ),
      "reference-image": toPositiveNumber(
        stored.featureMultipliers?.["reference-image"],
        defaultPricingRules.featureMultipliers["reference-image"]
      ),
      inpaint: toPositiveNumber(
        stored.featureMultipliers?.inpaint,
        defaultPricingRules.featureMultipliers.inpaint
      ),
      outpaint: toPositiveNumber(
        stored.featureMultipliers?.outpaint,
        defaultPricingRules.featureMultipliers.outpaint
      ),
      upscale: toPositiveNumber(
        stored.featureMultipliers?.upscale,
        defaultPricingRules.featureMultipliers.upscale
      ),
      "multi-image-fusion": toPositiveNumber(
        stored.featureMultipliers?.["multi-image-fusion"],
        defaultPricingRules.featureMultipliers["multi-image-fusion"]
      ),
      batch: toPositiveNumber(
        stored.featureMultipliers?.batch,
        defaultPricingRules.featureMultipliers.batch
      )
    }
  };
}

function normalizeRechargePlans(plans: unknown): RechargePlan[] {
  if (!Array.isArray(plans)) {
    return defaultRechargePlans;
  }

  const normalized = plans
    .filter((item): item is Partial<RechargePlan> =>
      typeof item === "object" && item !== null
    )
    .map((item, index) => {
      const credits = Number(item.credits);
      const bonusCredits = Number(item.bonusCredits ?? 0);
      const priceCny = Number(item.priceCny);

      return {
        id: String(item.id || `plan-${index + 1}`),
        name: String(item.name || `Plan ${index + 1}`),
        credits: Number.isFinite(credits) ? Math.max(1, Math.round(credits)) : 100,
        bonusCredits:
          Number.isFinite(bonusCredits) && bonusCredits > 0
            ? Math.round(bonusCredits)
            : 0,
        priceCny:
          Number.isFinite(priceCny) && priceCny > 0
            ? Math.round(priceCny * 100) / 100
            : 9.9,
        enabled: typeof item.enabled === "boolean" ? item.enabled : true,
        description: item.description ? String(item.description) : ""
      };
    });

  return normalized.length > 0 ? normalized : defaultRechargePlans;
}

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function taskKey(taskId: string) {
  return `task:${taskId}`;
}

function assetKey(assetId: string) {
  return `asset:${assetId}`;
}

function rechargeOrderKey(orderId: string) {
  return `recharge:${orderId}`;
}

function creditsKey(userId: string) {
  return `credits:${userId}`;
}

function userTasksKey(userId: string) {
  return `user:${userId}:tasks`;
}

function generationQueueKey() {
  return "queue:image-generation:pending";
}

function userAssetsKey(userId: string) {
  return `user:${userId}:assets`;
}

function userRechargeOrdersKey(userId: string) {
  return `user:${userId}:rechargeOrders`;
}

function adminListKey(name: string) {
  return `admin:${name}`;
}

export async function getModelPricing() {
  return normalizeModels(await storeGet<ModelPricing[]>(adminListKey("models")));
}

export async function getChannelConfigs() {
  return normalizeChannels(await storeGet<ChannelConfig[]>(adminListKey("channels")));
}

export async function getSensitiveWords() {
  return (await storeGet<string[]>(adminListKey("sensitiveWords"))) ?? [];
}

export async function getTemplates() {
  return (
    (await storeGet<Array<{ id: string; name: string; prompt: string }>>(
      adminListKey("templates")
    )) ?? []
  );
}

export async function getPricingRules() {
  return normalizePricingRules(await storeGet<PricingRules>(adminListKey("pricingRules")));
}

export async function getRechargePlans() {
  return normalizeRechargePlans(await storeGet<RechargePlan[]>(adminListKey("rechargePlans")));
}

export async function saveModelPricing(models: ModelPricing[]) {
  await storeSet(adminListKey("models"), normalizeModels(models));
}

export async function saveChannelConfigs(channels: ChannelConfig[]) {
  await storeSet(adminListKey("channels"), normalizeChannels(channels));
}

export async function savePricingRules(rules: PricingRules) {
  await storeSet(adminListKey("pricingRules"), normalizePricingRules(rules));
}

export async function saveRechargePlans(plans: RechargePlan[]) {
  await storeSet(adminListKey("rechargePlans"), normalizeRechargePlans(plans));
}

export async function getUserCredits(userId: string) {
  const credits = await storeGetNumber(creditsKey(userId));

  if (credits !== null) {
    return credits;
  }

  await storeIncrBy(creditsKey(userId), DEFAULT_CREDITS);
  return DEFAULT_CREDITS;
}

async function addCredits(userId: string, amount: number) {
  return await storeIncrBy(creditsKey(userId), amount);
}

export async function createRechargeOrder(input: {
  userId: string;
  planId: string;
  paymentNote?: string;
}) {
  const plans = await getRechargePlans();
  const plan = plans.find((item) => item.id === input.planId && item.enabled);

  if (!plan) {
    throw new Error("充值套餐不存在或已停用。");
  }

  const bonusCredits = plan.bonusCredits ?? 0;
  const order: RechargeOrder = {
    id: createId("recharge"),
    userId: input.userId,
    planId: plan.id,
    planName: plan.name,
    credits: plan.credits,
    bonusCredits,
    totalCredits: plan.credits + bonusCredits,
    priceCny: plan.priceCny,
    status: "pending",
    paymentNote: input.paymentNote?.trim() || "",
    createdAt: now(),
    updatedAt: now()
  };

  await storeSet(rechargeOrderKey(order.id), order);
  await storeListPush(userRechargeOrdersKey(input.userId), order.id, 100);
  await storeListPush("platform:rechargeOrders", order.id, 300);
  await addLog({
    type: "recharge_created",
    userId: input.userId,
    orderId: order.id,
    message: `创建充值订单 ${order.totalCredits} 积分`
  });

  return order;
}

export async function getRechargeOrder(orderId: string) {
  return await storeGet<RechargeOrder>(rechargeOrderKey(orderId));
}

export async function updateRechargeOrder(order: RechargeOrder) {
  await storeSet(rechargeOrderKey(order.id), {
    ...order,
    updatedAt: now()
  });
}

export async function getUserRechargeOrders(userId: string, limit = 30) {
  const orderIds = await storeListRange(userRechargeOrdersKey(userId), 0, limit - 1);
  const orders = await Promise.all(orderIds.map((orderId) => getRechargeOrder(orderId)));
  return orders.filter((order): order is RechargeOrder => Boolean(order));
}

export async function getRechargeOrders(limit = 100) {
  const orderIds = await storeListRange("platform:rechargeOrders", 0, limit - 1);
  const orders = await Promise.all(orderIds.map((orderId) => getRechargeOrder(orderId)));
  return orders.filter((order): order is RechargeOrder => Boolean(order));
}

export async function approveRechargeOrder(input: {
  orderId: string;
  adminNote?: string;
}) {
  const order = await getRechargeOrder(input.orderId);

  if (!order) {
    throw new Error("充值订单不存在。");
  }

  if (order.status !== "pending") {
    return order;
  }

  await addCredits(order.userId, order.totalCredits);

  const nextOrder: RechargeOrder = {
    ...order,
    status: "paid",
    adminNote: input.adminNote?.trim() || order.adminNote,
    finishedAt: now(),
    updatedAt: now()
  };

  await updateRechargeOrder(nextOrder);
  await addLog({
    type: "credits_added",
    userId: order.userId,
    orderId: order.id,
    message: `充值到账 ${order.totalCredits} 积分`
  });
  await addLog({
    type: "recharge_approved",
    userId: order.userId,
    orderId: order.id,
    message: `通过充值订单 ${order.id}`
  });

  return nextOrder;
}

export async function rejectRechargeOrder(input: {
  orderId: string;
  adminNote?: string;
}) {
  const order = await getRechargeOrder(input.orderId);

  if (!order) {
    throw new Error("充值订单不存在。");
  }

  if (order.status !== "pending") {
    return order;
  }

  const nextOrder: RechargeOrder = {
    ...order,
    status: "rejected",
    adminNote: input.adminNote?.trim() || order.adminNote,
    finishedAt: now(),
    updatedAt: now()
  };

  await updateRechargeOrder(nextOrder);
  await addLog({
    type: "recharge_rejected",
    userId: order.userId,
    orderId: order.id,
    message: `拒绝充值订单 ${order.id}`
  });

  return nextOrder;
}

async function addLog(log: Omit<PlatformLog, "id" | "createdAt">) {
  const item: PlatformLog = {
    id: createId("log"),
    createdAt: now(),
    ...log
  };

  await storeListPush("platform:logs", JSON.stringify(item), 200);
  return item;
}

export async function getPlatformLogs(limit = 80) {
  const items = await storeListRange("platform:logs", 0, limit - 1);
  return items.map((item) => JSON.parse(item) as PlatformLog);
}

export async function getUserTasks(userId: string, limit = 30) {
  const taskIds = await storeListRange(userTasksKey(userId), 0, limit - 1);
  const tasks = await Promise.all(taskIds.map((taskId) => getTask(taskId)));
  return tasks.filter((task): task is GenerationTask => Boolean(task));
}

export async function enqueueGenerationTask(taskId: string) {
  const queuedByBullMQ = await enqueueImageGenerationJob(taskId);

  if (!queuedByBullMQ) {
    await storeListPush(generationQueueKey(), taskId, 1000);
  }
}

export async function dequeueGenerationTask() {
  return await storeListPopRight(generationQueueKey());
}

export async function acquireWorkerLease(workerId: string, ttlSeconds = 55) {
  return await storeSetNxEx("queue:image-generation:worker-lease", workerId, ttlSeconds);
}

export async function releaseWorkerLease() {
  await storeDelete("queue:image-generation:worker-lease");
}

export async function recoverPendingGenerationTasks(limit = 200) {
  const taskIds = await storeListRange("platform:tasks", 0, limit - 1);
  const tasks = (await Promise.all(taskIds.map((taskId) => getTask(taskId)))).filter(
    (task): task is GenerationTask => Boolean(task)
  );
  const timeoutPaddingMs = Number(process.env.IMAGE_TASK_RECOVERY_MS ?? 300000);
  const cutoff = Date.now() - timeoutPaddingMs;
  let recovered = 0;

  await Promise.all(
    tasks.map(async (task) => {
      if (task.status === "pending") {
        await enqueueGenerationTask(task.id);
        recovered += 1;
        return;
      }

      if (
        task.status === "processing" &&
        new Date(task.updatedAt).getTime() < cutoff
      ) {
        await updateTask({
          ...task,
          status: "pending",
          error: task.error ?? "任务处理超时，已重新排队。",
          queuedAt: now(),
          updatedAt: now()
        });
        await enqueueGenerationTask(task.id);
        recovered += 1;
      }
    })
  );

  return recovered;
}

export async function getAsset(assetId: string) {
  return await storeGet<ImageAsset>(assetKey(assetId));
}

async function updateAsset(asset: ImageAsset) {
  await storeSet(assetKey(asset.id), {
    ...asset,
    updatedAt: now()
  });
}

export async function createImageAssets(input: {
  userId: string;
  task: GenerationTask;
  workflow: WorkflowJson;
  images: Array<{ imageUrl: string; mimeType: string }>;
  resultPrompt: string;
  originalPrompt: string;
  provider: "openai";
  model: string;
  referenceImages: ImageAsset["referenceImages"];
}) {
  const assets = input.images.map((image): ImageAsset => ({
    id: createId("asset"),
    userId: input.userId,
    imageUrl: image.imageUrl,
    mimeType: image.mimeType,
    prompt: input.resultPrompt,
    originalPrompt: input.originalPrompt,
    model: input.model,
    provider: input.provider,
    taskId: input.task.id,
    workflow: input.workflow,
    parameters: {
      aspectRatio: input.task.aspectRatio,
      resolution: input.task.resolution,
      detail: input.task.detail,
      count: input.task.count,
      feature: input.task.feature,
      costCredits: input.task.costCredits
    },
    referenceImages: input.referenceImages,
    favorite: false,
    deleted: false,
    createdAt: now(),
    updatedAt: now()
  }));

  await Promise.all(
    assets.map(async (asset) => {
      await storeSet(assetKey(asset.id), asset);
      await storeListPush(userAssetsKey(input.userId), asset.id, 500);
    })
  );

  return assets;
}

export async function getUserAssets(
  userId: string,
  scope: "works" | "history" | "favorites" | "downloads" | "trash" = "works",
  limit = 80
) {
  const assetIds = await storeListRange(userAssetsKey(userId), 0, limit - 1);
  const assets = (await Promise.all(assetIds.map((assetId) => getAsset(assetId)))).filter(
    (asset): asset is ImageAsset => Boolean(asset)
  );

  if (scope === "trash") return assets.filter((asset) => asset.deleted);
  if (scope === "favorites") return assets.filter((asset) => asset.favorite && !asset.deleted);
  if (scope === "downloads") return assets.filter((asset) => asset.downloadedAt && !asset.deleted);

  return assets.filter((asset) => !asset.deleted);
}

export async function updateUserAsset(input: {
  userId: string;
  assetId: string;
  action: "favorite" | "unfavorite" | "delete" | "restore" | "download";
}) {
  const asset = await getAsset(input.assetId);

  if (!asset || asset.userId !== input.userId) {
    throw new Error("资产不存在。");
  }

  const nextAsset: ImageAsset = {
    ...asset,
    favorite:
      input.action === "favorite"
        ? true
        : input.action === "unfavorite"
          ? false
          : asset.favorite,
    deleted:
      input.action === "delete"
        ? true
        : input.action === "restore"
          ? false
          : asset.deleted,
    deletedAt:
      input.action === "delete"
        ? now()
        : input.action === "restore"
          ? undefined
          : asset.deletedAt,
    downloadedAt: input.action === "download" ? now() : asset.downloadedAt,
    updatedAt: now()
  };

  await updateAsset(nextAsset);
  return nextAsset;
}

export async function getTask(taskId: string) {
  return await storeGet<GenerationTask>(taskKey(taskId));
}

export async function updateTask(task: GenerationTask) {
  await storeSet(taskKey(task.id), {
    ...task,
    updatedAt: now()
  });
}

function getResolutionMultiplier(
  resolution: string,
  rules: PricingRules
) {
  if (resolution === "4K") return rules.resolutionMultipliers["4K"];
  if (resolution === "2K") return rules.resolutionMultipliers["2K"];
  return rules.resolutionMultipliers["1K"];
}

function getDetailMultiplier(detail: string, rules: PricingRules) {
  if (detail === "high") return rules.detailMultipliers.high;
  if (detail === "medium") return rules.detailMultipliers.medium;
  return rules.detailMultipliers.low;
}

function getFeatureMultiplier(feature: GenerationFeature, rules: PricingRules) {
  return rules.featureMultipliers[feature] ?? 1;
}

function getModelReferenceMultiplier(
  feature: GenerationFeature,
  model?: ModelPricing
) {
  if (feature === "reference-image" || feature === "image-to-image") {
    return model?.referenceImageMultiplier ?? 1.25;
  }

  if (feature === "multi-image-fusion") {
    return model?.referenceImageMultiplier ?? 1.25;
  }

  return 1;
}

export function detectGenerationFeature(resolved: ResolvedImageWorkflow): GenerationFeature {
  const referenceCount = resolved.referenceImages.length;

  if (referenceCount >= 2) {
    return "multi-image-fusion";
  }

  if (referenceCount === 1) {
    return "reference-image";
  }

  if ((resolved.count ?? 1) > 1) {
    return "batch";
  }

  return "text-to-image";
}

export async function calculateTaskCost(
  resolved: ResolvedImageWorkflow,
  feature = detectGenerationFeature(resolved)
) {
  const models = await getModelPricing();
  const rules = await getPricingRules();
  const model = models.find((item) => item.id === resolved.model);
  const baseCredits = model?.baseCredits ?? 6;
  const modelMultiplier = model?.multiplier ?? 1;
  const modelRules: PricingRules = {
    ...rules,
    resolutionMultipliers: model?.resolutionMultipliers ?? rules.resolutionMultipliers,
    detailMultipliers: model?.detailMultipliers ?? rules.detailMultipliers
  };
  const count = resolved.count ?? 1;
  const rawCost =
    baseCredits *
    modelMultiplier *
    getResolutionMultiplier(resolved.resolution, modelRules) *
    getDetailMultiplier(resolved.detail, modelRules) *
    getModelReferenceMultiplier(feature, model) *
    getFeatureMultiplier(feature, rules) *
    count;

  return Math.max(1, Math.ceil(rawCost));
}

export async function validateGenerationRequest(resolved: ResolvedImageWorkflow) {
  const models = await getModelPricing();
  const model = models.find((item) => item.id === resolved.model);

  if (model && !model.enabled) {
    throw new Error(`模型 ${model.name} 当前已停用。`);
  }

  const sensitiveWords = await getSensitiveWords();
  const matchedWord = sensitiveWords.find((word) =>
    word.trim() ? resolved.prompt.toLowerCase().includes(word.trim().toLowerCase()) : false
  );

  if (matchedWord) {
    throw new Error(`提示词包含敏感词：${matchedWord}`);
  }
}

export async function createGenerationTask(input: {
  userId: string;
  workflow: WorkflowJson;
  resolved: ResolvedImageWorkflow;
}) {
  await validateGenerationRequest(input.resolved);

  const feature = detectGenerationFeature(input.resolved);
  const costCredits = await calculateTaskCost(input.resolved, feature);
  const currentCredits = await getUserCredits(input.userId);

  if (currentCredits < costCredits) {
    throw new Error(`积分不足。本次需要 ${costCredits} 积分，当前剩余 ${currentCredits} 积分。`);
  }

  await addCredits(input.userId, -costCredits);

  const task: GenerationTask = {
    id: createId("task"),
    userId: input.userId,
    status: "pending",
    feature,
    workflow: input.workflow,
    prompt: input.resolved.prompt,
    model: input.resolved.model,
    aspectRatio: input.resolved.aspectRatio,
    resolution: input.resolved.resolution,
    detail: input.resolved.detail,
    count: input.resolved.count ?? 1,
    costCredits,
    attempts: 0,
    maxAttempts: Number(process.env.IMAGE_TASK_MAX_ATTEMPTS ?? 3),
    timeoutMs: Number(process.env.IMAGE_TASK_TIMEOUT_MS ?? 180000),
    queuedAt: now(),
    createdAt: now(),
    updatedAt: now()
  };

  await storeSet(taskKey(task.id), task);
  await enqueueGenerationTask(task.id);
  await storeListPush(userTasksKey(input.userId), task.id, 100);
  await storeListPush("platform:tasks", task.id, 200);
  await addLog({
    type: "credits_debited",
    userId: input.userId,
    taskId: task.id,
    message: `扣除 ${costCredits} 积分`
  });
  await addLog({
    type: "task_created",
    userId: input.userId,
    taskId: task.id,
    message: `创建 ${feature} 任务`
  });

  return task;
}

export async function markTaskProcessing(task: GenerationTask) {
  const nextTask: GenerationTask = {
    ...task,
    status: "processing",
    attempts: (task.attempts ?? 0) + 1,
    startedAt: task.startedAt ?? now(),
    updatedAt: now()
  };

  await updateTask(nextTask);
  await addLog({
    type: "task_processing",
    userId: task.userId,
    taskId: task.id,
    message: "任务开始处理"
  });
  return nextTask;
}

export async function markTaskRetry(task: GenerationTask, error: string) {
  const nextTask: GenerationTask = {
    ...task,
    status: "pending",
    error,
    queuedAt: now(),
    updatedAt: now()
  };

  await updateTask(nextTask);
  await enqueueGenerationTask(nextTask.id);
  await addLog({
    type: "task_failed",
    userId: task.userId,
    taskId: task.id,
    message: `任务重试：${error}`
  });
  return nextTask;
}

export async function markTaskSuccess(
  task: GenerationTask,
  result: NonNullable<GenerationTask["result"]>
) {
  const nextTask: GenerationTask = {
    ...task,
    status: "success",
    result,
    finishedAt: now(),
    updatedAt: now()
  };

  await updateTask(nextTask);
  await addLog({
    type: "task_success",
    userId: task.userId,
    taskId: task.id,
    message: "任务生成成功"
  });
  return nextTask;
}

export async function markTaskFailed(task: GenerationTask, error: string) {
  const refundCredits = task.refundedCredits ? 0 : task.costCredits;

  if (refundCredits > 0) {
    await addCredits(task.userId, refundCredits);
  }

  const nextTask: GenerationTask = {
    ...task,
    status: "failed",
    error,
    refundedCredits: (task.refundedCredits ?? 0) + refundCredits,
    finishedAt: now(),
    updatedAt: now()
  };

  await updateTask(nextTask);
  await addLog({
    type: "credits_refunded",
    userId: task.userId,
    taskId: task.id,
    message: `失败退回 ${task.costCredits} 积分`
  });
  await addLog({
    type: "task_failed",
    userId: task.userId,
    taskId: task.id,
    message: error
  });
  return nextTask;
}

export async function cancelGenerationTask(input: {
  taskId: string;
  userId: string;
}) {
  const task = await getTask(input.taskId);

  if (!task || task.userId !== input.userId) {
    throw new Error("任务不存在。");
  }

  if (task.status === "success" || task.status === "failed") {
    return task;
  }

  if (task.status === "pending") {
    return await markTaskFailed({ ...task, cancelRequested: true }, "任务已取消。");
  }

  const nextTask: GenerationTask = {
    ...task,
    cancelRequested: true,
    error: "任务取消中，当前生成请求结束后会停止。",
    updatedAt: now()
  };

  await updateTask(nextTask);
  return nextTask;
}

export async function getAdminOverview() {
  const taskIds = await storeListRange("platform:tasks", 0, 99);
  const tasks = (await Promise.all(taskIds.map((taskId) => getTask(taskId)))).filter(
    (task): task is GenerationTask => Boolean(task)
  );

  return {
    models: await getModelPricing(),
    channels: await getChannelConfigs(),
    pricingRules: await getPricingRules(),
    rechargePlans: await getRechargePlans(),
    rechargeOrders: await getRechargeOrders(100),
    sensitiveWords: await getSensitiveWords(),
    templates: await getTemplates(),
    logs: await getPlatformLogs(80),
    tasks,
    stats: {
      totalTasks: tasks.length,
      pending: tasks.filter((task) => task.status === "pending").length,
      processing: tasks.filter((task) => task.status === "processing").length,
      success: tasks.filter((task) => task.status === "success").length,
      failed: tasks.filter((task) => task.status === "failed").length
    }
  };
}

export function isAdminUser(username: string) {
  const admins = (process.env.ADMIN_USERS ?? process.env.AUTH_USERS ?? "")
    .split(/[\n,]/)
    .map((entry) => entry.trim().split(":")[0])
    .filter(Boolean);

  return admins.includes(username);
}
