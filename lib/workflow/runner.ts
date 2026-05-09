import type { ParsedWorkflow } from "./schema";
import type { ImageAspectRatio } from "@/types/workflow";

export type ResolvedImageWorkflow = {
  model:
    | "gpt-image-2-plus"
    | "gpt-image-1.5"
    | "gemini-3.1-flash-image-preview"
    | "gemini-3-pro-image-preview";
  prompt: string;
  aspectRatio: ImageAspectRatio;
  resolution: "1K" | "2K" | "4K";
  detail: "low" | "medium" | "high";
  count: 1 | 2 | 3 | 4;
  size: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality: "low" | "medium" | "high" | "auto";
  referenceImages: Array<{
    refName: string;
    imageUrl: string;
    mimeType: string;
  }>;
};

const SUPPORTED_ASPECT_RATIOS = [
  "1:1",
  "9:16",
  "16:9",
  "3:4",
  "4:3",
  "3:2",
  "2:3",
  "5:4",
  "4:5",
  "21:9"
] as const;

const STYLE_TEXT: Record<string, string> = {
  cinematic: "cinematic lighting, high detail, dramatic composition",
  editorial: "editorial photography, clean composition, refined color grading",
  anime: "anime illustration, expressive character design, crisp linework",
  product: "premium product render, studio lighting, sharp focus",
  watercolor: "watercolor painting, soft pigment edges, handmade texture"
};

function assertNodeExists(
  workflow: ParsedWorkflow,
  type: string,
  nodeId?: string
) {
  const node = nodeId
    ? workflow.nodes.find((item) => item.id === nodeId && item.type === type)
    : workflow.nodes.find((item) => item.type === type);

  if (!node) {
    throw new Error(
      nodeId
        ? `Workflow is missing required ${type} node: ${nodeId}.`
        : `Workflow is missing required ${type} node.`
    );
  }

  return node;
}

function getAncestors(workflow: ParsedWorkflow, targetId: string) {
  const sourceIds = new Set(
    workflow.edges.filter((edge) => edge.target === targetId).map((edge) => edge.source)
  );

  return workflow.nodes.filter((node) => sourceIds.has(node.id));
}

function normalizePromptForRatio(prompt: string) {
  return prompt
    .toLowerCase()
    .replace(/[：]/g, ":")
    .replace(/[×x]/g, "x")
    .replace(/\s+/g, " ");
}

function inferAspectRatio(prompt: string): Exclude<ImageAspectRatio, "auto"> {
  const text = normalizePromptForRatio(prompt);
  const explicitRatio = text.match(
    /\b(1:1|9:16|16:9|3:4|4:3|3:2|2:3|5:4|4:5|21:9)\b/
  )?.[1];

  if (explicitRatio && SUPPORTED_ASPECT_RATIOS.includes(explicitRatio as never)) {
    return explicitRatio as Exclude<ImageAspectRatio, "auto">;
  }

  if (
    /手机壁纸|竖屏|竖版|短视频|story|reels|tiktok|抖音|小红书封面/.test(text)
  ) {
    return "9:16";
  }

  if (/海报|人物海报|全身|人像|肖像|穿搭|杂志封面/.test(text)) {
    return "3:4";
  }

  if (/横屏|横版|电影画幅|电影感|电脑壁纸|桌面壁纸|风景|banner|横幅|封面图/.test(text)) {
    return "16:9";
  }

  if (/产品图|商品图|头像|图标|logo|四宫格|九宫格|贴纸|表情包/.test(text)) {
    return "1:1";
  }

  return "1:1";
}

export function resolveImageWorkflow(
  workflow: ParsedWorkflow,
  generateNodeId?: string
): ResolvedImageWorkflow {
  const generateNode = assertNodeExists(workflow, "imageGenerate", generateNodeId);
  const upstreamNodes = getAncestors(workflow, generateNode.id);

  const promptNode =
    upstreamNodes.find((node) => node.type === "textPrompt") ??
    workflow.nodes.find((node) => node.type === "textPrompt");
  const styleNode =
    upstreamNodes.find((node) => node.type === "stylePreset") ??
    workflow.nodes.find((node) => node.type === "stylePreset");

  const prompt = String(generateNode.data.prompt ?? promptNode?.data.prompt ?? "").trim();
  const preset = String(generateNode.data.preset ?? styleNode?.data.preset ?? "cinematic");
  const styleText = STYLE_TEXT[preset] ?? preset;
  const upstreamReferenceImages = upstreamNodes
    .filter((node) => node.type === "referenceImage")
    .map((node) => ({
      refName: String(node.data.refName ?? node.data.label ?? node.id)
        .replace(/^@/, "")
        .trim(),
      imageUrl: String(node.data.imageUrl ?? ""),
      mimeType: String(node.data.mimeType ?? "image/png")
    }))
    .filter((image) => image.refName && image.imageUrl);
  const namedReferences = upstreamReferenceImages.filter((image) =>
    prompt.includes(`@${image.refName}`)
  );
  const referenceImages =
    namedReferences.length > 0 ? namedReferences : upstreamReferenceImages;
  const referenceText =
    referenceImages.length > 0
      ? ` Use the connected reference image(s): ${referenceImages
          .map((image) => `@${image.refName}`)
          .join(", ")}.`
      : "";

  if (!prompt) {
    throw new Error("Image Generate node needs a prompt before running.");
  }

  const rawAspectRatio =
    String(generateNode.data.aspectRatio ?? "") ||
    (String(generateNode.data.size ?? "1024x1024") === "1024x1536"
      ? "2:3"
      : String(generateNode.data.size ?? "1024x1024") === "1536x1024"
        ? "3:2"
        : "1:1");
  const aspectRatio =
    rawAspectRatio === "auto"
      ? inferAspectRatio(`${prompt} ${preset}`)
      : rawAspectRatio;
  const sizeByAspectRatio = {
    "1:1": "1024x1024",
    "2:3": "1024x1536",
    "3:2": "1536x1024"
  } as const;
  const resolution = String(generateNode.data.resolution ?? "1K");
  const normalizedResolution = ["1K", "2K", "4K"].includes(resolution)
    ? resolution
    : "4K";
  const rawCount = Number(generateNode.data.count ?? 1);
  const count = [1, 2, 3, 4].includes(rawCount) ? rawCount : 1;

  return {
    model: String(generateNode.data.model ?? "gpt-image-1.5") as ResolvedImageWorkflow["model"],
    prompt: `${prompt}. Style: ${styleText}.${referenceText}`,
    aspectRatio: aspectRatio as ImageAspectRatio,
    resolution: normalizedResolution as ResolvedImageWorkflow["resolution"],
    detail: String(
      generateNode.data.detail ?? generateNode.data.quality ?? "medium"
    ) as ResolvedImageWorkflow["detail"],
    count: count as ResolvedImageWorkflow["count"],
    size: sizeByAspectRatio[aspectRatio as keyof typeof sizeByAspectRatio] ?? "1024x1024",
    quality: String(
      generateNode.data.detail ?? generateNode.data.quality ?? "medium"
    ) as ResolvedImageWorkflow["quality"],
    referenceImages
  };
}
