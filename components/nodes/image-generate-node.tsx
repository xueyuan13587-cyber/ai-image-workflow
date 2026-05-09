"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  ChevronDown,
  Coins,
  GripHorizontal,
  ImagePlus,
  Plus,
  Send,
  Sparkles,
  Square
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useWorkflowStore } from "@/store/workflow-store";
import type {
  ImageAspectRatio,
  ImageGenerateData,
  ImageModel,
  ReferenceImageData,
  WorkflowNode
} from "@/types/workflow";

type Option<T extends string> = {
  value: T;
  label: string;
};

const imageModels: Array<Option<ImageModel>> = [
  { value: "gpt-image-2-plus", label: "Image 2" },
  { value: "gpt-image-1.5", label: "Image 1.5" },
  { value: "gemini-3.1-flash-image-preview", label: "Banana2" },
  { value: "gemini-3-pro-image-preview", label: "Banana Pro" }
];

const presets: Array<Option<ImageGenerateData["preset"]>> = [
  { value: "cinematic", label: "电影感" },
  { value: "editorial", label: "杂志大片" },
  { value: "anime", label: "动漫插画" },
  { value: "product", label: "产品摄影" },
  { value: "watercolor", label: "水彩画" }
];

const aspectRatios: Array<Option<ImageAspectRatio>> = [
  { value: "auto", label: "自动" },
  { value: "1:1", label: "1:1" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "5:4", label: "5:4" },
  { value: "4:5", label: "4:5" },
  { value: "21:9", label: "21:9" }
];

const resolutions: Array<Option<ImageGenerateData["resolution"]>> = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" }
];

const details: Array<Option<ImageGenerateData["detail"]>> = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" }
];

const counts: Array<Option<"1" | "2" | "3" | "4">> = [
  { value: "1", label: "1 张" },
  { value: "2", label: "2 张" },
  { value: "3", label: "3 张" },
  { value: "4", label: "4 张" }
];

const modelAspectRatios: Record<ImageModel, ImageAspectRatio[]> = {
  "gpt-image-1.5": ["auto", "1:1", "2:3", "3:2"],
  "gpt-image-2-plus": [
    "auto",
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
  ],
  "gemini-3.1-flash-image-preview": [
    "auto",
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
  ],
  "gemini-3-pro-image-preview": [
    "auto",
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
  ]
};

function CustomSelect<T extends string>({
  icon,
  label,
  value,
  options,
  onChange,
  className = ""
}: {
  icon?: React.ReactNode;
  label?: string;
  value: T;
  options: Array<Option<T>>;
  onChange: (value: T) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className={`nodrag nowheel tapnow-menu-wrap ${className}`}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        className="tapnow-menu-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
        title={label}
      >
        {icon}
        <span className="truncate">{selected?.label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-white/45" />
      </button>

      {open && (
        <div
          className="tapnow-menu-list"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {options.map((option) => (
            <button
              key={option.value}
              className="tapnow-menu-item"
              type="button"
              data-active={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ImageGenerateNode({ id, data }: NodeProps<WorkflowNode>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const addReferenceForNode = useWorkflowStore((state) => state.addReferenceForNode);
  const toWorkflowJson = useWorkflowStore((state) => state.toWorkflowJson);
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const nodeData = data as ImageGenerateData;
  const [referenceMenuOpen, setReferenceMenuOpen] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(nodeData.prompt ?? "");
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentModel = nodeData.model ?? "gpt-image-1.5";
  const supportedAspectRatios = modelAspectRatios[currentModel] ?? ["1:1"];
  const currentAspectRatio = supportedAspectRatios.includes(nodeData.aspectRatio)
    ? nodeData.aspectRatio
    : supportedAspectRatios[0];
  const currentResolution =
    resolutions.find((resolution) => resolution.value === nodeData.resolution)?.value ?? "4K";
  const currentDetail = nodeData.detail ?? "medium";
  const currentCount = String(nodeData.count ?? 1) as "1" | "2" | "3" | "4";
  const runState = useWorkflowStore((state) => state.runState);
  const connectedReferences = useMemo(() => {
    const sourceIds = new Set(
      edges.filter((edge) => edge.target === id).map((edge) => edge.source)
    );

    return nodes
      .filter((node) => node.type === "referenceImage" && sourceIds.has(node.id))
      .map((node) => {
        const referenceData = node.data as ReferenceImageData;

        return {
          id: node.id,
          refName: referenceData.refName || referenceData.label || node.id,
          imageUrl: referenceData.imageUrl,
          fileName: referenceData.fileName
        };
      });
  }, [edges, id, nodes]);

  useEffect(() => {
    setDraftPrompt(nodeData.prompt ?? "");
  }, [nodeData.prompt]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const workflow = toWorkflowJson();
        const draftWorkflow = {
          ...workflow,
          nodes: workflow.nodes.map((node) =>
            node.id === id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    prompt: draftPrompt
                  }
                }
              : node
          )
        };
        const requestBody = {
          ...draftWorkflow,
          targetGenerateNodeId: id
        };
        const response = await fetch("/api/pricing/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        if (!response.ok) {
          setEstimatedCost(null);
          return;
        }

        const payload = (await response.json()) as { costCredits?: number };
        setEstimatedCost(
          typeof payload.costCredits === "number" ? payload.costCredits : null
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setEstimatedCost(null);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    currentAspectRatio,
    currentCount,
    currentDetail,
    currentModel,
    currentResolution,
    draftPrompt,
    edges,
    id,
    nodeData.preset,
    nodes,
    toWorkflowJson
  ]);

  function commitPrompt(nextPrompt = draftPrompt) {
    if (nextPrompt !== nodeData.prompt) {
      updateNodeData(id, { prompt: nextPrompt });
    }
  }

  function insertReference(refName: string) {
    const token = `@${refName}`;
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? draftPrompt.length;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;
    const needsLeadingSpace =
      selectionStart > 0 && !/\s/.test(draftPrompt[selectionStart - 1] ?? "");
    const needsTrailingSpace = !/\s/.test(draftPrompt[selectionEnd] ?? " ");
    const insertText = `${needsLeadingSpace ? " " : ""}${token}${needsTrailingSpace ? " " : ""}`;
    const nextPrompt =
      draftPrompt.slice(0, selectionStart) + insertText + draftPrompt.slice(selectionEnd);
    const nextCursor = selectionStart + insertText.length;

    setDraftPrompt(nextPrompt);
    updateNodeData(id, { prompt: nextPrompt });
    setReferenceMenuOpen(false);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function requestRun() {
    commitPrompt();
    window.dispatchEvent(
      new CustomEvent("workflow-run-request", {
        detail: { generateNodeId: id }
      })
    );
  }

  return (
    <div className="tapnow-compose-node">
      <Handle
        type="target"
        id="input"
        position={Position.Left}
        className="tapnow-plus-handle tapnow-port tapnow-port-target !-left-5 !top-1/2 !h-9 !w-9 !border-0 !bg-white/85"
      >
        <Plus className="h-5 w-5" />
      </Handle>
      <Handle
        type="source"
        id="output"
        position={Position.Right}
        className="tapnow-plus-handle tapnow-port tapnow-port-source !-right-6 !top-1/2 !h-10 !w-10 !border-0 !bg-cyan-300"
      >
        <Plus className="h-5 w-5" />
      </Handle>

      <div className="tapnow-compose-head">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-orange-300 to-orange-500" />
          <span>图片生成</span>
        </div>
        <div className="tapnow-compose-drag-handle" title="拖动节点">
          <GripHorizontal className="h-4 w-4" />
        </div>
      </div>

      <div className="tapnow-compose-card-tools nodrag">
          <button
            className="tapnow-compose-icon"
            type="button"
            title="添加参考图节点"
            onClick={() => addReferenceForNode(id)}
          >
            <Plus className="h-5 w-5" />
          </button>
          <div className="tapnow-reference-menu-wrap">
            <button
              className="tapnow-compose-icon"
              type="button"
              title="引用图片"
              onClick={() => setReferenceMenuOpen((current) => !current)}
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            {referenceMenuOpen && (
              <div
                className="tapnow-reference-menu"
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="px-2 pb-2 text-[11px] font-semibold text-white/42">
                  已连接参考图
                </div>
                {connectedReferences.length === 0 ? (
                  <div className="px-2 py-3 text-xs leading-5 text-white/42">
                    还没有连接参考图。点击左侧加号添加一个。
                  </div>
                ) : (
                  connectedReferences.map((reference) => (
                    <button
                      key={reference.id}
                      className="tapnow-reference-menu-item"
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertReference(reference.refName)}
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                        {reference.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={reference.imageUrl}
                            alt={reference.refName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImagePlus className="m-3 h-6 w-6 text-white/35" />
                        )}
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="truncate text-sm font-semibold text-white">
                          @{reference.refName}
                        </div>
                        <div className="truncate text-[11px] text-white/38">
                          {reference.fileName ?? "点击插入引用"}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

      <div className="tapnow-compose-card nodrag">
        <textarea
          ref={textareaRef}
          value={draftPrompt}
          onChange={(event) => setDraftPrompt(event.currentTarget.value)}
          onBlur={() => commitPrompt()}
          onKeyDown={(event) => event.stopPropagation()}
          onKeyUp={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onCompositionStart={(event) => event.stopPropagation()}
          onCompositionUpdate={(event) => event.stopPropagation()}
          onCompositionEnd={(event) => event.stopPropagation()}
          className="nodrag nowheel tapnow-compose-textarea"
          placeholder="描述任何你想要生成的内容"
        />
      </div>

      <div className="tapnow-compose-toolbar nodrag">
        <div className="tapnow-compose-controls">
        <CustomSelect
          icon={<Sparkles className="h-4 w-4 text-white/65" />}
          label="模型"
          value={currentModel}
          options={imageModels}
          onChange={(nextModel) => {
            const nextSupportedRatios = modelAspectRatios[nextModel] ?? ["1:1"];

            updateNodeData(id, {
              model: nextModel,
              aspectRatio: nextSupportedRatios.includes(nodeData.aspectRatio)
                ? nodeData.aspectRatio
                : nextSupportedRatios[0]
            });
          }}
          className="min-w-[132px]"
        />

        <span className="tapnow-compose-divider" />

        <CustomSelect
          icon={<Square className="h-4 w-4 text-white/65" />}
          label="比例"
          value={currentAspectRatio}
          options={aspectRatios.filter((aspectRatio) =>
            supportedAspectRatios.includes(aspectRatio.value)
          )}
          onChange={(aspectRatio) => updateNodeData(id, { aspectRatio })}
          className="min-w-[84px]"
        />

        <span className="tapnow-compose-dot">·</span>

        <CustomSelect
          label="分辨率"
          value={currentResolution}
          options={resolutions}
          onChange={(resolution) => updateNodeData(id, { resolution })}
          className="min-w-[64px]"
        />

        <span className="tapnow-compose-dot">·</span>

        <CustomSelect
          label="精细度"
          value={currentDetail}
          options={details}
          onChange={(detail) => updateNodeData(id, { detail })}
          className="min-w-[60px]"
        />

        <span className="tapnow-compose-divider" />

        <CustomSelect
          icon={<ImagePlus className="h-4 w-4 text-white/65" />}
          label="风格"
          value={nodeData.preset}
          options={presets}
          onChange={(preset) => updateNodeData(id, { preset })}
          className="min-w-[112px]"
        />

        </div>

        <div className="tapnow-compose-actions">
          <CustomSelect
            label="生成数量"
            value={currentCount}
            options={counts}
            onChange={(count) =>
              updateNodeData(id, {
                count: Number(count) as ImageGenerateData["count"]
              })
            }
            className="min-w-[70px]"
          />
          <span className="tapnow-cost-pill" title="预计消耗积分">
            <Coins className="h-4 w-4" />
            {estimatedCost ?? "--"}
          </span>
          <button
            className="tapnow-compose-submit"
            type="button"
            onClick={requestRun}
            disabled={runState === "running"}
            title="运行生成"
          >
            {runState === "running" ? (
              <span className="tapnow-compose-spinner" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span>{runState === "running" ? "生成中" : "生成"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
