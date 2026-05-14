"use client";

import type { NodeProps } from "@xyflow/react";

import { NodeShell } from "@/modules/workflow/components/nodes/node-shell";
import { useWorkflowStore } from "@/modules/workflow/store/workflow-store";
import type { StylePresetData, WorkflowNode } from "@/types/workflow";

const presets = [
  { value: "cinematic", label: "电影感" },
  { value: "editorial", label: "杂志大片" },
  { value: "anime", label: "动漫插画" },
  { value: "product", label: "产品摄影" },
  { value: "watercolor", label: "水彩画" }
];

export function StylePresetNode({ id, data }: NodeProps<WorkflowNode>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const nodeData = data as StylePresetData;

  return (
    <NodeShell title={nodeData.label} tone="green" target={false}>
      <select
        value={nodeData.preset}
        onChange={(event) =>
          updateNodeData(id, { preset: event.currentTarget.value })
        }
        className="nodrag h-10 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-cyan-300/70"
      >
        {presets.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-3 gap-2">
        {["场景", "质感", "氛围"].map((item) => (
          <div
            key={item}
            className="rounded-lg border border-white/8 bg-white/[0.05] px-2 py-2 text-center text-[11px] text-white/45"
          >
            {item}
          </div>
        ))}
      </div>
    </NodeShell>
  );
}
