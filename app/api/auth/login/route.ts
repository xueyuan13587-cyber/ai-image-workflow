import { NextResponse } from "next/server";

import {
  createSessionToken,
  getAuthUsers,
  getSessionCookieOptions,
  SESSION_COOKIE,
  validateLogin
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const users = getAuthUsers();

    if (users.length === 0) {
      return NextResponse.json(
        { error: "服务器还没有配置登录账号。请设置 AUTH_USERS。" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";

    if (!username || !password || !validateLogin(username, password)) {
      return NextResponse.json({ error: "账号或密码不正确。" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      SESSION_COOKIE,
      createSessionToken(username),
      getSessionCookieOptions()
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "登录失败。" },
      { status: 500 }
    );
  }
}
