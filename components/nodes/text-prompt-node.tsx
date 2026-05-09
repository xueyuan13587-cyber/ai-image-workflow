"use client";

import type { NodeProps } from "@xyflow/react";

import { NodeShell } from "@/components/nodes/node-shell";
import { useWorkflowStore } from "@/store/workflow-store";
import type { TextPromptData, WorkflowNode } from "@/types/workflow";

export function TextPromptNode({ id, data }: NodeProps<WorkflowNode>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const nodeData = data as TextPromptData;

  return (
    <NodeShell title={nodeData.label} tone="blue" target={false}>
      <textarea
        value={nodeData.prompt}
        onChange={(event) =>
          updateNodeData(id, { prompt: event.currentTarget.value })
        }
        className="nodrag min-h-32 w-full resize-none rounded-lg border border-white/10 bg-white/[0.06] p-3 text-sm leading-5 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/70"
        placeholder="描述你想生成的图片..."
      />
      <div className="flex gap-2 text-[11px] text-white/40">
        <span className="rounded-full bg-white/[0.07] px-2 py-1">提示词</span>
        <span className="rounded-full bg-white/[0.07] px-2 py-1">文本输入</span>
      </div>
    </NodeShell>
  );
}
