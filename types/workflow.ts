import type { Edge, Node } from "@xyflow/react";

export type WorkflowNodeType =
  | "textPrompt"
  | "stylePreset"
  | "referenceImage"
  | "imageGenerate"
  | "imagePreview";

export type TextPromptData = {
  label: string;
  prompt: string;
};

export type StylePresetData = {
  label: string;
  preset: string;
};

export type ReferenceImageData = {
  label: string;
  refName: string;
  imageUrl?: string;
  fileName?: string;
  mimeType?: string;
  imageWidth?: number;
  imageHeight?: number;
  uploadStatus?: "idle" | "uploading" | "ready" | "error";
  uploadError?: string;
};

export type ImageModel =
  | "gpt-image-2-plus"
  | "gpt-image-1.5"
  | "gemini-3.1-flash-image-preview"
  | "gemini-3-pro-image-preview";

export type ImageAspectRatio =
  | "auto"
  | "1:1"
  | "9:16"
  | "16:9"
  | "3:4"
  | "4:3"
  | "3:2"
  | "2:3"
  | "5:4"
  | "4:5"
  | "21:9";

export type ImageGenerateData = {
  label: string;
  model: ImageModel;
  prompt: string;
  preset: "cinematic" | "editorial" | "anime" | "product" | "watercolor";
  aspectRatio: ImageAspectRatio;
  resolution: "1K" | "2K" | "4K";
  detail: "low" | "medium" | "high";
  count?: 1 | 2 | 3 | 4;
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
};

export type ImagePreviewData = {
  label: string;
  imageUrl?: string;
  status?: "idle" | "running" | "ready" | "error";
};

export type WorkflowNodeData =
  | TextPromptData
  | StylePresetData
  | ReferenceImageData
  | ImageGenerateData
  | ImagePreviewData;

export type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;
export type WorkflowEdge = Edge;

export type WorkflowJson = {
  version: "1.0";
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type RunWorkflowResponse = {
  workflow: WorkflowJson;
  task?: {
    id: string;
    status: "pending" | "processing" | "success" | "failed";
    feature: string;
    costCredits: number;
    refundedCredits?: number;
  };
  billing?: {
    creditsBefore?: number;
    creditsAfter?: number;
  };
  result: {
    imageUrl: string;
    images?: Array<{
      imageUrl: string;
      mimeType: string;
    }>;
    mimeType: string;
    prompt: string;
    generateNodeId?: string;
    provider: "openai";
    model: string;
  };
};

export type ImageHistoryItem = {
  id: string;
  imageUrl: string;
  prompt: string;
  model: string;
  createdAt: string;
};
