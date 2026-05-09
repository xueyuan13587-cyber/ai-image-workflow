import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/lib/auth";
import { getUserCredits, getUserTasks, isAdminUser } from "@/lib/platform";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));

  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      username: session.username,
      isAdmin: isAdminUser(session.username),
      credits: await getUserCredits(session.username)
    },
    tasks: await getUserTasks(session.username, 10)
  });
}
