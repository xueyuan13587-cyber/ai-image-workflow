import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/modules/auth/server/auth";
import {
  getAdminOverview,
  isAdminUser,
  saveChannelConfigs,
  saveModelPricing,
  savePricingRules,
  saveRechargePlans
} from "@/modules/admin/server/admin-service";
import { storeSet } from "@/modules/queue/server/redis-store";

export const runtime = "nodejs";

async function assertAdmin(request: Request) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));

  if (!session) {
    return { response: NextResponse.json({ error: "请先登录。" }, { status: 401 }) };
  }

  if (!isAdminUser(session.username)) {
    return { response: NextResponse.json({ error: "没有后台权限。" }, { status: 403 }) };
  }

  return { session };
}

export async function GET(request: Request) {
  const auth = await assertAdmin(request);

  if ("response" in auth) {
    return auth.response;
  }

  return NextResponse.json(await getAdminOverview());
}

export async function POST(request: Request) {
  const auth = await assertAdmin(request);

  if ("response" in auth) {
    return auth.response;
  }

  const body = (await request.json()) as {
    models?: Awaited<ReturnType<typeof getAdminOverview>>["models"];
    channels?: Awaited<ReturnType<typeof getAdminOverview>>["channels"];
    pricingRules?: Awaited<ReturnType<typeof getAdminOverview>>["pricingRules"];
    rechargePlans?: Awaited<ReturnType<typeof getAdminOverview>>["rechargePlans"];
    sensitiveWords?: string[];
    templates?: Array<{ id: string; name: string; prompt: string }>;
  };

  if (body.models) {
    await saveModelPricing(body.models);
  }

  if (body.channels) {
    await saveChannelConfigs(body.channels);
  }

  if (body.pricingRules) {
    await savePricingRules(body.pricingRules);
  }

  if (body.rechargePlans) {
    await saveRechargePlans(body.rechargePlans);
  }

  if (body.sensitiveWords) {
    await storeSet("admin:sensitiveWords", body.sensitiveWords);
  }

  if (body.templates) {
    await storeSet("admin:templates", body.templates);
  }

  return NextResponse.json(await getAdminOverview());
}
