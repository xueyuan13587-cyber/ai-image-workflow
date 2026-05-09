import crypto from "node:crypto";

export const SESSION_COOKIE = "aiwf_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type AuthUser = {
  username: string;
  password: string;
};

export type AuthSession = {
  username: string;
  expiresAt: number;
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "local-development-auth-secret";
  }

  throw new Error("AUTH_SECRET is not configured.");
}

export function getAuthUsers() {
  const rawUsers = process.env.AUTH_USERS;

  if (!rawUsers && process.env.NODE_ENV !== "production") {
    return [{ username: "admin", password: "admin123" }];
  }

  if (!rawUsers) {
    return [];
  }

  return rawUsers
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map<AuthUser | null>((entry) => {
      const separatorIndex = entry.indexOf(":");

      if (separatorIndex <= 0) {
        return null;
      }

      return {
        username: entry.slice(0, separatorIndex).trim(),
        password: entry.slice(separatorIndex + 1)
      };
    })
    .filter((user): user is AuthUser => Boolean(user?.username && user.password));
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

function encodeSession(session: AuthSession) {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function decodeSession(payload: string) {
  const decoded = Buffer.from(payload, "base64url").toString("utf8");

  return JSON.parse(decoded) as AuthSession;
}

export function createSessionToken(username: string) {
  const session: AuthSession = {
    username,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  };
  const payload = encodeSession(session);

  return `${payload}.${signPayload(payload)}`;
}

export function verifySessionToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const session = decodeSession(payload);

    if (!session.username || session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function validateLogin(username: string, password: string) {
  const user = getAuthUsers().find((candidate) => candidate.username === username);

  if (!user) {
    return false;
  }

  const passwordBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(user.password);

  return (
    passwordBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(passwordBuffer, expectedBuffer)
  );
}

export function getSessionFromCookieHeader(cookieHeader?: string | null) {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const sessionCookie = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));

  if (!sessionCookie) {
    return null;
  }

  return verifySessionToken(decodeURIComponent(sessionCookie.slice(SESSION_COOKIE.length + 1)));
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  };
}
