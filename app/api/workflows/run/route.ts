import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/modules/auth/server/auth";
import { getUserCredits } from "@/modules/billing/server/billing-service";
import { createGenerationTask } from "@/modules/generation/server/task-service";
import { canUseBullMQQueue } from "@/modules/queue/server/image-queue";
import { runImageTaskWorker } from "@/modules/queue/server/image-task-worker";
import { resolveImageWorkflow } from "@/modules/workflow/server/runner";
import { workflowSchema } from "@/modules/workflow/server/schema";
import type { WorkflowJson } from "@/types/workflow";

export const runtime = "nodejs";

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
      setTimeout(() => {
        void runImageTaskWorker().catch((error) => {
          console.error("image worker failed", error);
        });
      }, 0);
    }

    return NextResponse.json(
      {
        workflow,
        queued: true,
        task: {
          id: task.id,
          status: task.status,
          feature: task.feature,
          costCredits: task.costCredits,
          refundedCredits: task.refundedCredits
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
