import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/lib/auth";
import {
  createGenerationTask,
  getUserCredits,
  markTaskFailed,
  markTaskProcessing,
  markTaskSuccess
} from "@/lib/platform";
import { generateOpenAIImages } from "@/lib/providers/openai-images";
import { resolveImageWorkflow } from "@/lib/workflow/runner";
import { workflowSchema } from "@/lib/workflow/schema";
import type { WorkflowJson } from "@/types/workflow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let createdTask: Awaited<ReturnType<typeof createGenerationTask>> | null = null;

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
    createdTask = await createGenerationTask({
      userId: session.username,
      workflow,
      resolved
    });
    const processingTask = await markTaskProcessing(createdTask);
    const generation = await generateOpenAIImages(resolved);
    const firstImage = generation.images[0];

    if (!firstImage) {
      throw new Error("Image generation returned no images.");
    }

    const successTask = await markTaskSuccess(processingTask, {
      imageUrl: firstImage.imageUrl,
      mimeType: firstImage.mimeType,
      images: generation.images,
      provider: "openai",
      model: generation.model
    });
    const creditsAfter = await getUserCredits(session.username);

    return NextResponse.json({
      workflow,
      task: {
        id: successTask.id,
        status: successTask.status,
        feature: successTask.feature,
        costCredits: successTask.costCredits
      },
      billing: {
        creditsBefore,
        creditsAfter
      },
      result: {
        imageUrl: firstImage.imageUrl,
        mimeType: firstImage.mimeType,
        images: generation.images,
        prompt: resolved.prompt,
        generateNodeId: targetGenerateNodeId,
        provider: "openai",
        model: generation.model
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to run workflow.";

    if (createdTask && createdTask.status !== "failed") {
      const failedTask = await markTaskFailed(createdTask, message);

      return NextResponse.json(
        {
          error: message,
          task: {
            id: failedTask.id,
            status: failedTask.status,
            feature: failedTask.feature,
            costCredits: failedTask.costCredits,
            refundedCredits: failedTask.refundedCredits
          }
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
