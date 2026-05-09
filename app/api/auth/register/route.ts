import { NextResponse } from "next/server";

import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE
} from "@/lib/auth";
import { createUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";
    const user = await createUser(username, password);
    const response = NextResponse.json({ ok: true });

    response.cookies.set(
      SESSION_COOKIE,
      createSessionToken(user.username),
      getSessionCookieOptions()
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "注册失败。" },
      { status: 400 }
    );
  }
}
