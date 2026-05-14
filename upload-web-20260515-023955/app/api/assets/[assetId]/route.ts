import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/modules/auth/server/auth";
import { updateUserAsset } from "@/modules/assets/server/assets-service";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const session = getSessionFromCookieHeader(request.headers.get("cookie"));

    if (!session) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }

    const { assetId } = await params;
    const body = (await request.json()) as {
      action?: "favorite" | "unfavorite" | "delete" | "restore" | "download";
    };

    if (!body.action) {
      return NextResponse.json({ error: "缺少资产操作。" }, { status: 400 });
    }

    const asset = await updateUserAsset({
      userId: session.username,
      assetId,
      action: body.action
    });

    return NextResponse.json({ asset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "资产操作失败。" },
      { status: 400 }
    );
  }
}
