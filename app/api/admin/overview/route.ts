import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/modules/auth/server/auth";
import { getAdminOverview, isAdminUser } from "@/modules/admin/server/admin-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));

  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  if (!isAdminUser(session.username)) {
    return NextResponse.json({ error: "没有后台权限。" }, { status: 403 });
  }

  return NextResponse.json(await getAdminOverview());
}
