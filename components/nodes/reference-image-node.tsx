"use client";

import { ImagePlus } from "lucide-react";
import type { ChangeEvent } from "react";
import type { NodeProps } from "@xyflow/react";

import { NodeShell } from "@/components/nodes/node-shell";
import { useWorkflowStore } from "@/store/workflow-store";
import type { ReferenceImageData, WorkflowNode } from "@/types/workflow";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readImageSize(imageUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height
      });
    image.onerror = () => reject(new Error("图片尺寸读取失败。"));
    image.src = imageUrl;
  });
}

async function uploadReferenceImage(imageData: string, fileName: string) {
  const response = await fetch("/api/uploads/reference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageData, fileName })
  });
  const payload = (await response.json()) as { imageUrl?: string; error?: string };

  if (!response.ok || !payload.imageUrl) {
    throw new Error(payload.error ?? "图片上传失败。");
  }

  return payload.imageUrl;
}

export function ReferenceImageNode({ id, data }: NodeProps<WorkflowNode>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const nodeData = data as ReferenceImageData;
  const imageRatio =
    nodeData.imageWidth && nodeData.imageHeight
      ? `${nodeData.imageWidth} / ${nodeData.imageHeight}`
      : "4 / 3";

  async function setImageMetadata(imageUrl: string) {
    try {
      const size = await readImageSize(imageUrl);

      updateNodeData(id, {
        imageWidth: size.width,
        imageHeight: size.height
      });
    } catch {
      updateNodeData(id, {
        imageWidth: undefined,
        imageHeight: undefined
      });
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) return;

    const imageUrl = await readFileAsDataUrl(file);
    await setImageMetadata(imageUrl);

    updateNodeData(id, {
      imageUrl,
      fileName: file.name,
      mimeType: file.type || "image/png",
      uploadStatus: "uploading",
      uploadError: undefined
    });

    try {
      const publicImageUrl = await uploadReferenceImage(imageUrl, file.name);

      updateNodeData(id, {
        imageUrl: publicImageUrl,
        fileName: file.name,
        mimeType: file.type || "image/png",
        uploadStatus: "ready",
        uploadError: undefined
      });
    } catch (error) {
      updateNodeData(id, {
        uploadStatus: "error",
        uploadError: error instanceof Error ? error.message : "图片上传失败。"
      });
    }
  }

  function handleUrlChange(value: string) {
    updateNodeData(id, {
      imageUrl: value,
      fileName: value ? "网络图片" : undefined,
      mimeType: "image/jpeg",
      imageWidth: undefined,
      imageHeight: undefined
    });

    if (value) {
      void setImageMetadata(value);
    }
  }

  return (
    <NodeShell title={nodeData.label} tone="blue" target={false}>
      <label className="block text-xs font-medium text-white/45">
        引用名称
        <div className="mt-1 flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-white focus-within:border-cyan-300/70">
          <span className="text-white/35">@</span>
          <input
            value={nodeData.refName}
            onChange={(event) =>
              updateNodeData(id, {
                refName: event.currentTarget.value.replace(/\s+/g, "-")
              })
            }
            className="nodrag min-w-0 flex-1 bg-transparent outline-none"
            placeholder="product"
          />
        </div>
      </label>
      <label className="block text-xs font-medium text-white/45">
        图片 URL
        <input
          value={
            nodeData.imageUrl?.startsWith("http://") ||
            nodeData.imageUrl?.startsWith("https://")
              ? nodeData.imageUrl
              : ""
          }
          onChange={(event) => handleUrlChange(event.currentTarget.value)}
          className="nodrag mt-1 h-10 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/70"
          placeholder="https://example.com/image.jpg"
        />
      </label>
      <label
        className="nodrag flex max-h-[260px] min-h-[130px] w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.05] text-sm text-white/45 transition hover:border-cyan-300/50 hover:text-cyan-100"
        style={{ aspectRatio: imageRatio }}
      >
        {nodeData.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={nodeData.imageUrl}
            alt={nodeData.fileName ?? nodeData.refName}
            className="h-full w-full object-contain"
          />
        ) : (
          <>
            <ImagePlus className="h-7 w-7" />
            上传参考图
          </>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleUpload}
          className="hidden"
        />
      </label>
      <div className="flex items-center justify-between gap-3 text-[11px] text-white/38">
        <span className="truncate">{nodeData.fileName ?? "尚未选择图片"}</span>
        <span className="shrink-0">
          {nodeData.uploadStatus === "uploading"
            ? "上传中"
            : nodeData.uploadStatus === "ready"
              ? "公网 URL 就绪"
              : `@${nodeData.refName || "参考图"}`}
        </span>
      </div>
      {nodeData.uploadError && (
        <p className="text-[11px] leading-4 text-red-200">{nodeData.uploadError}</p>
      )}
      <p className="text-[11px] leading-4 text-white/35">
        本地上传会尝试转成公网图片 URL；如果未配置 Cloudinary，可以粘贴公网图片链接。
      </p>
    </NodeShell>
  );
}
