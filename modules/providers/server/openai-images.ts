import type { ResolvedImageWorkflow } from "@/modules/workflow/server/runner";

type GenerateImageResult = {
  imageUrl: string;
  mimeType: string;
  model: string;
};

type GenerateImagesResult = {
  images: Array<{
    imageUrl: string;
    mimeType: string;
  }>;
  model: string;
};

type UnifiedImageResponse = {
  data?:
    | Array<{
        b64_json?: string;
        url?: string;
      }>
    | {
        outputs?: Array<string | { url?: string; image_url?: string; b64_json?: string }>;
        urls?: {
          get?: string;
        };
        status?: string;
        b64_json?: string;
        url?: string;
        image_url?: string;
      };
  output?: string | string[];
  outputs?: Array<string | { url?: string; image_url?: string; b64_json?: string }>;
  images?: Array<string | { url?: string; image_url?: string; b64_json?: string }>;
  url?: string;
  image_url?: string;
  b64_json?: string;
  error?: {
    message?: string;
  };
  message?: string;
  msg?: string;
  code?: string | number;
};

class ModelOverloadedError extends Error {
  constructor() {
    super("模型繁忙，请稍后重试，或先切换到 Banana2 / Banana Pro。");
    this.name = "ModelOverloadedError";
  }
}

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_GPTSAPI_BASE_URL = "https://api.gptsapi.net";

function getOpenAIBaseUrl() {
  return (process.env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL).replace(/\/$/, "");
}

function getGptsApiBaseUrl() {
  return (
    process.env.GPTSAPI_BASE_URL ??
    process.env.OPENAI_BASE_URL?.replace(/\/v1$/, "") ??
    DEFAULT_GPTSAPI_BASE_URL
  ).replace(/\/$/, "");
}

function createApiHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "x-api-key": apiKey,
    "Content-Type": "application/json"
  };
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.replace(/\s+/g, " ").slice(0, 240);

    throw new Error(
      `API returned non-JSON response from ${response.url}. Status ${response.status}. Preview: ${preview}`
    );
  }
}

function getApiErrorMessage(response: Response, payload: UnifiedImageResponse) {
  const payloadMessage =
    payload.error?.message ??
    payload.message ??
    payload.msg ??
    JSON.stringify(payload).slice(0, 500);

  return `API request failed (${response.status} ${response.statusText}) from ${response.url}: ${payloadMessage}`;
}

function getPayloadText(payload: UnifiedImageResponse) {
  return JSON.stringify(payload).toLowerCase();
}

function isModelOverloaded(payload: UnifiedImageResponse) {
  const payloadText = getPayloadText(payload);

  return payloadText.includes("model is overloaded") || payloadText.includes("try again later");
}

function normalizeImageValue(value?: string) {
  if (!value) return undefined;

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  return `data:image/png;base64,${value}`;
}

function parseAspectRatio(value: string) {
  const [rawWidth, rawHeight] = value.split(":").map((part) => Number(part));

  if (!rawWidth || !rawHeight) {
    return undefined;
  }

  return rawWidth / rawHeight;
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:(?<mime>[^;]+);base64,(?<data>.+)$/);

  if (!match?.groups?.data) {
    return undefined;
  }

  return {
    mimeType: match.groups.mime ?? "image/png",
    buffer: Buffer.from(match.groups.data, "base64")
  };
}

function getResolutionLongEdge(resolution: ResolvedImageWorkflow["resolution"]) {
  if (resolution === "4K") return 4096;
  if (resolution === "2K") return 2048;
  return 1024;
}

function getTargetDimensions(aspectRatio: string, resolution: ResolvedImageWorkflow["resolution"]) {
  const ratio = parseAspectRatio(toGptsApiAspectRatio(aspectRatio)) ?? 1;
  const longEdge = getResolutionLongEdge(resolution);

  if (ratio > 1) {
    return {
      width: longEdge,
      height: Math.round(longEdge / ratio)
    };
  }

  if (ratio < 1) {
    return {
      width: Math.round(longEdge * ratio),
      height: longEdge
    };
  }

  return {
    width: longEdge,
    height: longEdge
  };
}

async function imageUrlToBuffer(imageUrl: string) {
  const dataUrl = parseDataUrl(imageUrl);

  if (dataUrl) {
    return dataUrl.buffer;
  }

  if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
    return undefined;
  }

  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download generated image for aspect ratio fix: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function enforceOutputGeometry(
  imageUrl: string,
  aspectRatio: string,
  resolution: ResolvedImageWorkflow["resolution"]
) {
  const targetRatio = parseAspectRatio(toGptsApiAspectRatio(aspectRatio));

  if (!targetRatio) {
    return {
      imageUrl,
      mimeType: "image/png"
    };
  }

  const imageBuffer = await imageUrlToBuffer(imageUrl);

  if (!imageBuffer) {
    return {
      imageUrl,
      mimeType: "image/png"
    };
  }

  const sharp = (await import("sharp")).default;
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) {
    return {
      imageUrl,
      mimeType: "image/png"
    };
  }

  const currentRatio = width / height;
  const targetDimensions = getTargetDimensions(aspectRatio, resolution);
  const hasTargetGeometry =
    Math.abs(currentRatio - targetRatio) < 0.01 &&
    width === targetDimensions.width &&
    height === targetDimensions.height;

  if (hasTargetGeometry) {
    return {
      imageUrl,
      mimeType: "image/png"
    };
  }

  const targetWidth = targetDimensions.width;
  const targetHeight = targetDimensions.height;
  const backgroundBuffer = await sharp(imageBuffer)
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "cover"
    })
    .blur(24)
    .modulate({ brightness: 0.72, saturation: 0.9 })
    .png()
    .toBuffer();
  const foregroundBuffer = await sharp(imageBuffer)
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  const fixedBuffer = await sharp(backgroundBuffer)
    .composite([{ input: foregroundBuffer }])
    .png()
    .toBuffer();

  return {
    imageUrl: `data:image/png;base64,${fixedBuffer.toString("base64")}`,
    mimeType: "image/png"
  };
}

function readImageFromMixedOutput(
  output?: string | { url?: string; image_url?: string; b64_json?: string }
) {
  if (!output) return undefined;

  if (typeof output === "string") {
    return normalizeImageValue(output);
  }

  return normalizeImageValue(output.url ?? output.image_url ?? output.b64_json);
}

function getImageUrl(payload: UnifiedImageResponse) {
  const firstDataImage = Array.isArray(payload.data) ? payload.data[0] : undefined;
  const objectData = !Array.isArray(payload.data) ? payload.data : undefined;

  return (
    normalizeImageValue(firstDataImage?.b64_json ?? firstDataImage?.url) ??
    readImageFromMixedOutput(objectData?.outputs?.[0]) ??
    normalizeImageValue(objectData?.b64_json ?? objectData?.url ?? objectData?.image_url) ??
    readImageFromMixedOutput(Array.isArray(payload.output) ? payload.output[0] : payload.output) ??
    readImageFromMixedOutput(payload.outputs?.[0]) ??
    readImageFromMixedOutput(payload.images?.[0]) ??
    normalizeImageValue(payload.b64_json ?? payload.url ?? payload.image_url)
  );
}

function getPollUrl(payload: UnifiedImageResponse) {
  return Array.isArray(payload.data) ? undefined : payload.data?.urls?.get;
}

function getStatus(payload: UnifiedImageResponse) {
  return Array.isArray(payload.data) ? undefined : payload.data?.status;
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollImageResult(resultUrl: string, apiKey: string) {
  let lastPayload: UnifiedImageResponse | undefined;

  for (let attempt = 0; attempt < 45; attempt += 1) {
    await wait(attempt === 0 ? 1000 : 2000);

    const response = await fetch(resultUrl, {
      method: "GET",
      headers: createApiHeaders(apiKey)
    });
    const payload = await readApiResponse<UnifiedImageResponse>(response);

    if (isModelOverloaded(payload)) {
      throw new ModelOverloadedError();
    }

    if (!response.ok) {
      throw new Error(getApiErrorMessage(response, payload));
    }

    if (getImageUrl(payload)) {
      return payload;
    }

    const status = getStatus(payload);

    if (status && ["failed", "canceled", "cancelled", "error"].includes(status)) {
      if (isModelOverloaded(payload)) {
        throw new ModelOverloadedError();
      }

      throw new Error(`Image task failed: ${JSON.stringify(payload).slice(0, 500)}`);
    }

    lastPayload = payload;
  }

  throw new Error(
    `Image task did not finish in time: ${JSON.stringify(lastPayload).slice(0, 500)}`
  );
}

function toGptsApiAspectRatio(size: string) {
  if (
    ["1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "5:4", "4:5", "21:9"].includes(size)
  ) {
    return size;
  }
  if (size === "1536x1024") return "3:2";
  if (size === "1024x1536") return "2:3";
  return "1:1";
}

function toOpenAIImageSize(aspectRatio: string) {
  if (["9:16", "3:4", "2:3", "4:5"].includes(aspectRatio)) return "1024x1536";
  if (["16:9", "4:3", "3:2", "5:4", "21:9"].includes(aspectRatio)) return "1536x1024";
  return "1024x1024";
}

function getDetailPrompt(detail: ResolvedImageWorkflow["detail"]) {
  if (detail === "high") {
    return "Use rich fine detail, precise textures, crisp edges, and a polished high fidelity finish.";
  }

  if (detail === "low") {
    return "Use a simpler composition with fewer small details and a clean readable finish.";
  }

  return "Use balanced detail with clear subject definition and natural texture.";
}

function withGenerationDirectives(
  prompt: string,
  aspectRatio: string,
  detail: ResolvedImageWorkflow["detail"]
) {
  return `${prompt}\n\nCompose the image natively in ${aspectRatio} aspect ratio. Do not add borders, letterboxing, pillarboxing, or padding. ${getDetailPrompt(detail)}`;
}

function isPublicImageUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function getV3ModelPath(model: string) {
  if (model === "gpt-image-2-plus") {
    return "openai/gpt-image-2-plus";
  }

  if (model === "gemini-3.1-flash-image-preview") {
    return "google/gemini-3.1-flash-image-preview";
  }

  if (model === "gemini-3-pro-image-preview") {
    return "google/gemini-3-pro-image-preview";
  }

  return undefined;
}

async function generateV3Image(
  input: ResolvedImageWorkflow,
  apiKey: string,
  model: string,
  aspectRatio: string
): Promise<GenerateImageResult> {
  const modelPath = getV3ModelPath(model);

  if (!modelPath) {
    throw new Error(`Unsupported v3 image model: ${model}`);
  }

  const hasReferenceImage = input.referenceImages.length > 0;
  const endpoint = hasReferenceImage ? "image-edit" : "text-to-image";
  const referenceImages = input.referenceImages.map((image) => image.imageUrl);

  if (hasReferenceImage && referenceImages.some((imageUrl) => !isPublicImageUrl(imageUrl))) {
    throw new Error(
      "该图生图接口只接受公网图片 URL。请在参考图节点粘贴 https 图片链接，或先配置 Cloudinary 自动上传。"
    );
  }

  const requestBody = {
    prompt: withGenerationDirectives(
      input.prompt,
      toGptsApiAspectRatio(aspectRatio),
      input.detail ?? "medium"
    ),
    ...(hasReferenceImage ? { images: referenceImages } : {}),
    aspect_ratio: toGptsApiAspectRatio(aspectRatio),
    output_format: hasReferenceImage ? "jpeg" : "png"
  };

  console.info("v3 image request", {
    model,
    endpoint,
    aspect_ratio: requestBody.aspect_ratio
  });

  let finalPayload: UnifiedImageResponse | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${getGptsApiBaseUrl()}/api/v3/${modelPath}/${endpoint}`, {
        method: "POST",
        headers: createApiHeaders(apiKey),
        body: JSON.stringify(requestBody)
      });
      const payload = await readApiResponse<UnifiedImageResponse>(response);

      if (isModelOverloaded(payload)) {
        throw new ModelOverloadedError();
      }

      if (!response.ok) {
        throw new Error(getApiErrorMessage(response, payload));
      }

      finalPayload = getImageUrl(payload)
        ? payload
        : getPollUrl(payload)
          ? await pollImageResult(getPollUrl(payload)!, apiKey)
          : payload;
      break;
    } catch (error) {
      if (!(error instanceof ModelOverloadedError) || attempt === 2) {
        throw error;
      }

      await wait((attempt + 1) * 3000);
    }
  }

  if (!finalPayload) {
    throw new Error("Image task did not return a result.");
  }

  const imageUrl = getImageUrl(finalPayload);

  if (!imageUrl) {
    throw new Error(`API returned no image data: ${JSON.stringify(finalPayload).slice(0, 500)}`);
  }

  const fixedImage = await enforceOutputGeometry(
    imageUrl,
    input.aspectRatio ?? aspectRatio,
    input.resolution ?? "1K"
  );

  return {
    imageUrl: fixedImage.imageUrl,
    mimeType: fixedImage.mimeType,
    model
  };
}

export async function generateOpenAIImage(
  input: ResolvedImageWorkflow
): Promise<GenerateImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const model = input.model ?? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1.5";
  const size = toOpenAIImageSize(input.aspectRatio ?? "1:1");
  const quality =
    input.detail ?? input.quality ?? process.env.OPENAI_IMAGE_QUALITY ?? "medium";

  if (getV3ModelPath(model)) {
    return generateV3Image(input, apiKey, model, input.aspectRatio ?? "1:1");
  }

  const response = await fetch(`${getOpenAIBaseUrl()}/images/generations`, {
    method: "POST",
    headers: createApiHeaders(apiKey),
    body: JSON.stringify({
      model,
      prompt: withGenerationDirectives(
        input.prompt,
        input.aspectRatio ?? "1:1",
        input.detail ?? "medium"
      ),
      n: 1,
      size,
      quality
    })
  });

  const payload = await readApiResponse<UnifiedImageResponse>(response);

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response, payload));
  }

  const imageUrl = getImageUrl(payload);

  if (!imageUrl) {
    throw new Error(`API returned no image data: ${JSON.stringify(payload).slice(0, 500)}`);
  }

  const fixedImage = await enforceOutputGeometry(
    imageUrl,
    input.aspectRatio ?? "1:1",
    input.resolution ?? "1K"
  );

  return {
    imageUrl: fixedImage.imageUrl,
    mimeType: fixedImage.mimeType,
    model
  };
}

export async function generateOpenAIImages(
  input: ResolvedImageWorkflow
): Promise<GenerateImagesResult> {
  const count = input.count ?? 1;
  const images: GenerateImagesResult["images"] = [];
  let model: string = input.model ?? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1.5";

  for (let index = 0; index < count; index += 1) {
    const image = await generateOpenAIImage(input);

    model = image.model;
    images.push({
      imageUrl: image.imageUrl,
      mimeType: image.mimeType
    });
  }

  return {
    images,
    model
  };
}
