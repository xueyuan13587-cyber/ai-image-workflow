import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/modules/auth/server/auth";
import { getAdminOverview, isAdminUser } from "@/modules/admin/server/admin-service";
import {
  approveRechargeOrder,
  rejectRechargeOrder
} from "@/modules/billing/server/billing-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = getSessionFromCookieHeader(request.headers.get("cookie"));

    if (!session) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }

    if (!isAdminUser(session.username)) {
      return NextResponse.json({ error: "没有后台权限。" }, { status: 403 });
    }

    const body = (await request.json()) as {
      orderId?: string;
      action?: "approve" | "reject";
      adminNote?: string;
    };

    if (!body.orderId) {
      return NextResponse.json({ error: "缺少订单 ID。" }, { status: 400 });
    }

    if (body.action === "approve") {
      await approveRechargeOrder({
        orderId: body.orderId,
        adminNote: body.adminNote
      });
    } else if (body.action === "reject") {
      await rejectRechargeOrder({
        orderId: body.orderId,
        adminNote: body.adminNote
      });
    } else {
      return NextResponse.json({ error: "未知订单操作。" }, { status: 400 });
    }

    return NextResponse.json(await getAdminOverview());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "处理充值订单失败。" },
      { status: 400 }
    );
  }
}
