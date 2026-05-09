import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/lib/auth";
import { createRechargeOrder, getUserRechargeOrders } from "@/lib/platform";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));

  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  return NextResponse.json({
    orders: await getUserRechargeOrders(session.username, 30)
  });
}

export async function POST(request: Request) {
  try {
    const session = getSessionFromCookieHeader(request.headers.get("cookie"));

    if (!session) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }

    const body = (await request.json()) as {
      planId?: string;
      paymentNote?: string;
    };

    if (!body.planId) {
      return NextResponse.json({ error: "请选择充值套餐。" }, { status: 400 });
    }

    const order = await createRechargeOrder({
      userId: session.username,
      planId: body.planId,
      paymentNote: body.paymentNote
    });

    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建充值订单失败。" },
      { status: 400 }
    );
  }
}
