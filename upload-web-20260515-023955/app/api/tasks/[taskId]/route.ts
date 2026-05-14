import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/modules/auth/server/auth";
import { cancelGenerationTask, getTask } from "@/modules/generation/server/task-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));

  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const { taskId } = await params;
  const task = await getTask(taskId);

  if (!task || task.userId !== session.username) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  return NextResponse.json({ task });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));

  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const { taskId } = await params;
  const body = (await request.json()) as { action?: "cancel" };

  if (body.action !== "cancel") {
    return NextResponse.json({ error: "不支持的任务操作。" }, { status: 400 });
  }

  return NextResponse.json({
    task: await cancelGenerationTask({
      taskId,
      userId: session.username
    })
  });
}
