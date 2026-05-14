import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/modules/auth/server/auth";
import { isAdminUser } from "@/modules/admin/server/admin-service";
import { runImageTaskWorker } from "@/modules/queue/server/image-task-worker";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorizedWorkerRequest(request: Request) {
  const workerSecret = process.env.IMAGE_WORKER_SECRET ?? process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-worker-secret");
  const authorization = request.headers.get("authorization");

  if (
    workerSecret &&
    (headerSecret === workerSecret || authorization === `Bearer ${workerSecret}`)
  ) {
    return true;
  }

  const session = getSessionFromCookieHeader(request.headers.get("cookie"));
  return Boolean(session && isAdminUser(session.username));
}

export async function POST(request: Request) {
  if (!isAuthorizedWorkerRequest(request)) {
    return NextResponse.json({ error: "无权执行图片 Worker。" }, { status: 401 });
  }

  return NextResponse.json(await runImageTaskWorker());
}

export async function GET(request: Request) {
  return POST(request);
}
