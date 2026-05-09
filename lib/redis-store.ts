type RedisResponse<T> = {
  result?: T;
  error?: string;
};

const memoryStore = new Map<string, string>();
const memoryLists = new Map<string, string[]>();

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    token
  };
}

export function isRedisConfigured() {
  return Boolean(getRedisConfig());
}

async function redisCommand<T>(command: unknown[]) {
  const config = getRedisConfig();

  if (!config) {
    throw new Error("Redis is not configured.");
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command),
    cache: "no-store"
  });
  const payload = (await response.json()) as RedisResponse<T>;

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Redis request failed.");
  }

  return payload.result;
}

export async function storeGet<T>(key: string) {
  if (!isRedisConfigured()) {
    const value = memoryStore.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  const value = await redisCommand<string | null>(["GET", key]);
  return value ? (JSON.parse(value) as T) : null;
}

export async function storeSet<T>(key: string, value: T) {
  const serialized = JSON.stringify(value);

  if (!isRedisConfigured()) {
    memoryStore.set(key, serialized);
    return;
  }

  await redisCommand<string>(["SET", key, serialized]);
}

export async function storeSetNx<T>(key: string, value: T) {
  const serialized = JSON.stringify(value);

  if (!isRedisConfigured()) {
    if (memoryStore.has(key)) {
      return false;
    }

    memoryStore.set(key, serialized);
    return true;
  }

  const result = await redisCommand<string | null>(["SET", key, serialized, "NX"]);
  return result === "OK";
}

export async function storeIncrBy(key: string, amount: number) {
  if (!isRedisConfigured()) {
    const current = Number(memoryStore.get(key) ?? "0");
    const next = current + amount;
    memoryStore.set(key, String(next));
    return next;
  }

  return await redisCommand<number>(["INCRBY", key, amount]);
}

export async function storeGetNumber(key: string) {
  if (!isRedisConfigured()) {
    const value = memoryStore.get(key);
    return value === undefined ? null : Number(value);
  }

  const value = await redisCommand<string | null>(["GET", key]);
  return value === null || value === undefined ? null : Number(value);
}

export async function storeListPush(key: string, value: string, maxLength = 100) {
  if (!isRedisConfigured()) {
    const list = memoryLists.get(key) ?? [];
    list.unshift(value);
    memoryLists.set(key, list.slice(0, maxLength));
    return;
  }

  await redisCommand<number>(["LPUSH", key, value]);
  await redisCommand<string>(["LTRIM", key, 0, maxLength - 1]);
}

export async function storeListRange(key: string, start = 0, stop = 99) {
  if (!isRedisConfigured()) {
    return (memoryLists.get(key) ?? []).slice(start, stop + 1);
  }

  return (await redisCommand<string[]>(["LRANGE", key, start, stop])) ?? [];
}
