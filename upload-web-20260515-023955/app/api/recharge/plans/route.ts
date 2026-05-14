import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/modules/auth/server/auth";
import { getRechargePlans } from "@/modules/billing/server/billing-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));

  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const plans = await getRechargePlans();

  return NextResponse.json({
    plans: plans.filter((plan) => plan.enabled)
  });
}
