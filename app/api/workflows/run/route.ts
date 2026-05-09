import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/lib/auth";
import { generateOpenAIImages } from "@/lib/providers/openai-images";
import { resolveImageWorkflow } from "@/lib/workflow/runner";
import { workflowSchema } from "@/lib/workflow/schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = getSessionFromCookieHeader(request.headers.get("cookie"));

    if (!session) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }

    const body = await request.json();
    const workflow = workflowSchema.parse(body);
    const resolved = resolveImageWorkflow(workflow);
    const generation = await generateOpenAIImages(resolved);
    const firstImage = generation.images[0];

    if (!firstImage) {
      throw new Error("Image generation returned no images.");
    }

    return NextResponse.json({
      workflow,
      result: {
        imageUrl: firstImage.imageUrl,
        mimeType: firstImage.mimeType,
        images: generation.images,
        prompt: resolved.prompt,
        provider: "openai",
        model: generation.model
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to run workflow.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
