import IORedis from "ioredis";

let connection: IORedis | undefined;

export function isBullMQConfigured() {
  return Boolean(process.env.REDIS_URL);
}

export function getBullMQConnection() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured. BullMQ requires a Redis TCP URL.");
  }

  if (!connection) {
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true
    });
  }

  return connection;
}

export async function closeBullMQConnection() {
  if (!connection) return;

  await connection.quit();
  connection = undefined;
}
