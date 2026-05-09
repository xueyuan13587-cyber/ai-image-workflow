import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/lib/auth";
import { calculateTaskCost, detectGenerationFeature } from "@/lib/platform";
import { resolveImageWorkflow } from "@/lib/workflow/runner";
import { workflowSchema } from "@/lib/workflow/schema";
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
    const feature = detectGenerationFeature(resolved);
    const costCredits = await calculateTaskCost(resolved, feature);

    return NextResponse.json({
      costCredits,
      feature,
      count: resolved.count,
      model: resolved.model
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "无法计算积分。" },
      { status: 400 }
    );
  }
}
