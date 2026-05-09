"use client";

import { createPortal } from "react-dom";
import { useState } from "react";
import { Download, ImageIcon, Maximize2, X } from "lucide-react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";

import { downloadImage } from "@/lib/download-image";
import type { ImagePreviewData, WorkflowNode } from "@/types/workflow";

export function ImagePreviewNode({ data, selected }: NodeProps<WorkflowNode>) {
  const nodeData = data as ImagePreviewData;
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  return (
    <>
      <div className="tapnow-preview-node">
        <NodeResizer
          isVisible={selected}
          minWidth={260}
          minHeight={240}
          handleClassName="tapnow-resize-handle"
          lineClassName="tapnow-resize-line"
        />
        <Handle
          type="target"
          id="input"
          position={Position.Left}
          className="tapnow-handle tapnow-port tapnow-port-target !left-2 !h-9 !w-9 !border-0 !bg-white/85"
        />

        <div className="tapnow-preview-header">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-slate-300 to-slate-500" />
            <span className="truncate">{nodeData.label}</span>
          </div>

          {nodeData.imageUrl && (
            <div className="nodrag flex shrink-0 items-center gap-2">
              <button
                className="tapnow-preview-action"
                type="button"
                title="查看大图"
                onClick={() => setIsLightboxOpen(true)}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                className="tapnow-preview-action"
                type="button"
                title="保存到本地"
                onClick={() => downloadImage(nodeData.imageUrl!, "generated-image.png")}
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="tapnow-preview-frame">
          {nodeData.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nodeData.imageUrl}
              alt="生成结果"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-sm text-white/40">
              <ImageIcon className="h-7 w-7 text-white/35" />
              {nodeData.status === "running" ? "生成中..." : "暂无图片"}
            </div>
          )}
        </div>
      </div>

      {isLightboxOpen &&
        nodeData.imageUrl &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="nodrag nopan fixed inset-0 z-[1000] flex items-center justify-center bg-black/82 p-8 backdrop-blur-xl"
            onClick={() => setIsLightboxOpen(false)}
          >
            <div className="relative flex max-h-full max-w-full items-center justify-center">
              <button
                className="absolute -right-3 -top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/12 text-white backdrop-blur transition hover:bg-white/20"
                type="button"
                title="关闭"
                onClick={() => setIsLightboxOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={nodeData.imageUrl}
                alt="生成大图"
                className="max-h-[86vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
