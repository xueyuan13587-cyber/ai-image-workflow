import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/modules/auth/server/auth";
import { getUserAssets } from "@/modules/assets/server/assets-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));

  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "works";
  const safeScope = ["works", "history", "favorites", "downloads", "trash"].includes(scope)
    ? (scope as "works" | "history" | "favorites" | "downloads" | "trash")
    : "works";

  return NextResponse.json({
    assets: await getUserAssets(session.username, safeScope)
  });
}
