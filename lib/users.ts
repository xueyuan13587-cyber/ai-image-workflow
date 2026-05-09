import crypto from "node:crypto";

import { getAuthUsers } from "@/lib/auth";

type StoredUser = {
  username: string;
  passwordHash: string;
  createdAt: string;
};

type RedisResponse<T> = {
  result?: T;
  error?: string;
};

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,24}$/;
const PASSWORD_MIN_LENGTH = 6;

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

export function isUserDatabaseConfigured() {
  return Boolean(getRedisConfig());
}

export function isSignupEnabled() {
  return process.env.ENABLE_SIGNUP === "true";
}

function getUserKey(username: string) {
  return `user:${username.toLowerCase()}`;
}

async function redisCommand<T>(command: unknown[]) {
  const config = getRedisConfig();

  if (!config) {
    throw new Error("User database is not configured.");
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
    throw new Error(payload.error ?? "User database request failed.");
  }

  return payload.result;
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");

  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterations, salt, hash] = storedHash.split("$");

  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !hash) {
    return false;
  }

  const candidate = crypto
    .pbkdf2Sync(password, salt, Number(iterations), 32, "sha256")
    .toString("hex");
  const candidateBuffer = Buffer.from(candidate);
  const hashBuffer = Buffer.from(hash);

  return (
    candidateBuffer.length === hashBuffer.length &&
    crypto.timingSafeEqual(candidateBuffer, hashBuffer)
  );
}

function normalizeUsername(username: string) {
  return username.trim();
}

export function validateNewUserInput(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username);

  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    return "账号只能使用 3-24 位英文、数字、下划线或短横线。";
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return "密码至少需要 6 位。";
  }

  return null;
}

async function getStoredUser(username: string) {
  if (!isUserDatabaseConfigured()) {
    return null;
  }

  const result = await redisCommand<string | null>(["GET", getUserKey(username)]);

  if (!result) {
    return null;
  }

  return JSON.parse(result) as StoredUser;
}

export async function createUser(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username);
  const validationError = validateNewUserInput(normalizedUsername, password);

  if (validationError) {
    throw new Error(validationError);
  }

  if (!isSignupEnabled()) {
    throw new Error("注册功能暂未开启。");
  }

  if (!isUserDatabaseConfigured()) {
    throw new Error("用户数据库还没有配置。请先配置 Upstash Redis。");
  }

  const user: StoredUser = {
    username: normalizedUsername,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };
  const result = await redisCommand<string | null>([
    "SET",
    getUserKey(normalizedUsername),
    JSON.stringify(user),
    "NX"
  ]);

  if (result !== "OK") {
    throw new Error("这个账号已经被注册。");
  }

  return user;
}

export async function validateUserLogin(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username);
  const storedUser = await getStoredUser(normalizedUsername);

  if (storedUser) {
    return verifyPassword(password, storedUser.passwordHash);
  }

  const envUser = getAuthUsers().find((candidate) => candidate.username === normalizedUsername);

  if (!envUser) {
    return false;
  }

  const passwordBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(envUser.password);

  return (
    passwordBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(passwordBuffer, expectedBuffer)
  );
}
