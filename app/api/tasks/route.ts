import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/lib/auth";
import { getUserTasks } from "@/lib/platform";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));

  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  return NextResponse.json({
    tasks: await getUserTasks(session.username, 50)
  });
}
