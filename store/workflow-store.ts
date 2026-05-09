"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange
} from "@xyflow/react";
import { create } from "zustand";

import type {
  ImageHistoryItem,
  ImagePreviewData,
  RunWorkflowResponse,
  WorkflowEdge,
  WorkflowJson,
  WorkflowNode
} from "@/types/workflow";

type RunState = "idle" | "running" | "success" | "error";

type WorkflowStore = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  history: ImageHistoryItem[];
  runState: RunState;
  error?: string;
  lastRun?: RunWorkflowResponse;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: WorkflowNode["type"]) => void;
  addReferenceForNode: (targetNodeId: string) => void;
  getConnectedReferenceImages: (targetNodeId: string) => Array<{
    id: string;
    refName: string;
    imageUrl?: string;
    fileName?: string;
  }>;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNode["data"]>) => void;
  loadHistory: () => void;
  clearHistory: () => void;
  restoreHistoryItem: (item: ImageHistoryItem) => void;
  setRunState: (state: RunState, error?: string) => void;
  setRunResult: (result: RunWorkflowResponse) => void;
  toWorkflowJson: () => WorkflowJson;
};

const HISTORY_KEY = "ai-image-workflow-history";
const MAX_HISTORY_ITEMS = 12;
const MAX_PERSISTED_IMAGE_CHARS = 900_000;

const initialNodes: WorkflowNode[] = [
  {
    id: "reference-1",
    type: "referenceImage",
    position: { x: -150, y: 190 },
    data: {
      label: "参考图",
      refName: "product"
    }
  },
  {
    id: "generate-1",
    type: "imageGenerate",
    position: { x: 230, y: 160 },
    data: {
      label: "图片生成",
      model: "gpt-image-1.5",
      prompt: "以 @product 作为主体，生成一张柔和晨光下的高级产品摄影图。",
      preset: "cinematic",
      aspectRatio: "1:1",
      resolution: "1K",
      detail: "medium",
      count: 1
    }
  },
  {
    id: "preview-1",
    type: "imagePreview",
    position: { x: 650, y: 190 },
    style: { width: 360, height: 320 },
    data: {
      label: "图片预览",
      status: "idle"
    }
  }
];

const initialEdges: WorkflowEdge[] = [
  {
    id: "reference-generate",
    source: "reference-1",
    sourceHandle: "output",
    target: "generate-1",
    targetHandle: "input"
  },
  {
    id: "generate-preview",
    source: "generate-1",
    sourceHandle: "output",
    target: "preview-1",
    targetHandle: "input"
  }
];

const defaultsByType = {
  textPrompt: {
    label: "文本提示词",
    prompt: "一张未来感图片工作流应用的干净产品摄影图"
  },
  stylePreset: { label: "风格预设", preset: "editorial" },
  referenceImage: {
    label: "参考图",
    refName: "reference"
  },
  imageGenerate: {
    label: "图片生成",
    model: "gpt-image-1.5",
    prompt: "以 @reference 作为主体，生成一张高级棚拍质感的干净产品图。",
    preset: "editorial",
    aspectRatio: "1:1",
    resolution: "1K",
    detail: "medium",
    count: 1
  },
  imagePreview: { label: "图片预览", status: "idle" }
} satisfies Record<WorkflowNode["type"], WorkflowNode["data"]>;

function createHistoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readHistory() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const history = raw ? (JSON.parse(raw) as ImageHistoryItem[]) : [];

    return history.filter(
      (item) =>
        !item.imageUrl.startsWith("data:") ||
        item.imageUrl.length <= MAX_PERSISTED_IMAGE_CHARS
    );
  } catch {
    window.localStorage.removeItem(HISTORY_KEY);
    return [];
  }
}

function writeHistory(history: ImageHistoryItem[]) {
  if (typeof window === "undefined") return;

  const persistableHistory = history.filter(
    (item) =>
      !item.imageUrl.startsWith("data:") ||
      item.imageUrl.length <= MAX_PERSISTED_IMAGE_CHARS
  );

  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(persistableHistory));
  } catch {
    const urlsOnly = persistableHistory.filter((item) => !item.imageUrl.startsWith("data:"));
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(urlsOnly.slice(0, 6)));
  }
}

function applyPreviewImage(nodes: WorkflowNode[], imageUrl: string) {
  return nodes.map((node) =>
    node.type === "imagePreview"
      ? {
          ...node,
          data: {
            ...node.data,
            imageUrl,
            status: "ready"
          } as ImagePreviewData
        }
      : node
  );
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  history: [],
  runState: "idle",
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  onConnect: (connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          sourceHandle: connection.sourceHandle ?? "output",
          targetHandle: connection.targetHandle ?? "input",
          animated: true
        },
        get().edges
      )
    });
  },
  addNode: (type) => {
    const count = get().nodes.length + 1;
    set({
      nodes: [
        ...get().nodes,
        {
          id: `${type}-${count}`,
          type,
          position: { x: 140 + count * 30, y: 120 + count * 24 },
          ...(type === "imagePreview" ? { style: { width: 360, height: 320 } } : {}),
          data: defaultsByType[type]
        }
      ]
    });
  },
  addReferenceForNode: (targetNodeId) => {
    const nodes = get().nodes;
    const targetNode = nodes.find((node) => node.id === targetNodeId);
    const count = nodes.filter((node) => node.type === "referenceImage").length + 1;
    const id = `reference-${Date.now()}`;

    set({
      nodes: [
        ...nodes,
        {
          id,
          type: "referenceImage",
          position: {
            x: (targetNode?.position.x ?? 360) - 300,
            y: (targetNode?.position.y ?? 180) + 20
          },
          data: {
            label: "参考图",
            refName: `reference-${count}`
          }
        }
      ],
      edges: addEdge(
        {
          id: `${id}-${targetNodeId}`,
          source: id,
          sourceHandle: "output",
          target: targetNodeId,
          targetHandle: "input",
          animated: true
        },
        get().edges
      )
    });
  },
  getConnectedReferenceImages: (targetNodeId) => {
    const sourceIds = new Set(
      get()
        .edges.filter((edge) => edge.target === targetNodeId)
        .map((edge) => edge.source)
    );

    return get()
      .nodes.filter((node) => node.type === "referenceImage" && sourceIds.has(node.id))
      .map((node) => {
        const data = node.data as {
          refName?: string;
          imageUrl?: string;
          fileName?: string;
          label?: string;
        };

        return {
          id: node.id,
          refName: data.refName ?? data.label ?? node.id,
          imageUrl: data.imageUrl,
          fileName: data.fileName
        };
      });
  },
  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } as WorkflowNode["data"] }
          : node
      )
    });
  },
  loadHistory: () => {
    set({ history: readHistory() });
  },
  clearHistory: () => {
    writeHistory([]);
    set({ history: [] });
  },
  restoreHistoryItem: (item) => {
    set({
      nodes: applyPreviewImage(get().nodes, item.imageUrl)
    });
  },
  setRunState: (runState, error) => {
    set({
      runState,
      error,
      nodes: get().nodes.map((node) =>
        node.type === "imagePreview"
          ? {
              ...node,
              data: {
                ...node.data,
                status:
                  runState === "running"
                    ? "running"
                    : (node.data as ImagePreviewData).status
              } as ImagePreviewData
            }
          : node
      )
    });
  },
  setRunResult: (lastRun) => {
    const resultImages =
      lastRun.result.images && lastRun.result.images.length > 0
        ? lastRun.result.images
        : [{ imageUrl: lastRun.result.imageUrl, mimeType: lastRun.result.mimeType }];
    const historyItems = resultImages.map((image) => ({
      id: createHistoryId(),
      imageUrl: image.imageUrl,
      prompt: lastRun.result.prompt,
      model: lastRun.result.model,
      createdAt: new Date().toISOString()
    }));
    const nextHistory = [
      ...historyItems,
      ...get().history
    ].slice(0, MAX_HISTORY_ITEMS);

    writeHistory(nextHistory);

    set({
      lastRun,
      history: nextHistory,
      runState: "success",
      error: undefined,
      nodes: applyPreviewImage(get().nodes, resultImages[0].imageUrl)
    });
  },
  toWorkflowJson: () => ({
    version: "1.0",
    nodes: get().nodes,
    edges: get().edges
  })
}));
