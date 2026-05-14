import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/modules/auth/server/auth";
import { getUserCredits } from "@/modules/billing/server/billing-service";
import { createGenerationTask, getTask } from "@/modules/generation/server/task-service";
import { canUseBullMQQueue } from "@/modules/queue/server/image-queue";
import { processGenerationTask } from "@/modules/queue/server/image-task-worker";
import { resolveImageWorkflow } from "@/modules/workflow/server/runner";
import { workflowSchema } from "@/modules/workflow/server/schema";
import type { WorkflowJson } from "@/types/workflow";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = getSessionFromCookieHeader(request.headers.get("cookie"));

    if (!session) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }

    const body = await request.json();
    const targetGenerateNodeId =
      typeof body.targetGenerateNodeId === "string"
        ? body.targetGenerateNodeId
        : undefined;
    const workflow = workflowSchema.parse(body) as WorkflowJson;
    const resolved = resolveImageWorkflow(workflow, targetGenerateNodeId);
    const creditsBefore = await getUserCredits(session.username);
    const task = await createGenerationTask({
      userId: session.username,
      workflow,
      resolved
    });
    const creditsAfter = await getUserCredits(session.username);

    if (!canUseBullMQQueue()) {
      await processGenerationTask(task);
    }

    const latestTask = await getTask(task.id);

    return NextResponse.json(
      {
        workflow,
        queued: true,
        task: {
          id: task.id,
          status: latestTask?.status ?? task.status,
          feature: task.feature,
          costCredits: task.costCredits,
          refundedCredits: latestTask?.refundedCredits ?? task.refundedCredits
        },
        billing: {
          creditsBefore,
          creditsAfter
        }
      },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to queue workflow." },
      { status: 400 }
    );
  }
}
