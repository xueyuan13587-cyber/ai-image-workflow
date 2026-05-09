"use client";

import "@xyflow/react/dist/style.css";

import { Controls, ReactFlow, type NodeTypes } from "@xyflow/react";
import {
  Coins,
  Download,
  History,
  Image as ImageIcon,
  ImagePlus,
  LogOut,
  Shield,
  Sparkles,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ImageGenerateNode } from "@/components/nodes/image-generate-node";
import { ImagePreviewNode } from "@/components/nodes/image-preview-node";
import { ReferenceImageNode } from "@/components/nodes/reference-image-node";
import { StylePresetNode } from "@/components/nodes/style-preset-node";
import { TextPromptNode } from "@/components/nodes/text-prompt-node";
import { downloadImage } from "@/lib/download-image";
import { useWorkflowStore } from "@/store/workflow-store";
import type { ImageHistoryItem, RunWorkflowResponse, WorkflowNode } from "@/types/workflow";

const nodeTypes: NodeTypes = {
  textPrompt: TextPromptNode,
  stylePreset: StylePresetNode,
  referenceImage: ReferenceImageNode,
  imageGenerate: ImageGenerateNode,
  imagePreview: ImagePreviewNode
};

const nodeButtons: Array<{
  type: WorkflowNode["type"];
  label: string;
  icon: typeof Sparkles;
}> = [
  { type: "referenceImage", label: "参考图", icon: ImagePlus },
  { type: "imageGenerate", label: "图片生成", icon: Sparkles },
  { type: "imagePreview", label: "图片预览", icon: ImageIcon }
];

type AccountState = {
  user: {
    username: string;
    isAdmin: boolean;
    credits: number;
  };
  tasks: Array<{
    id: string;
    status: "pending" | "processing" | "success" | "failed";
    model: string;
    costCredits: number;
    refundedCredits?: number;
    createdAt: string;
  }>;
};

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function HistoryPanel({
  history,
  onRestore,
  onClear,
  onClose
}: {
  history: ImageHistoryItem[];
  onRestore: (item: ImageHistoryItem) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <aside className="absolute left-24 top-24 z-30 max-h-[calc(100vh-8rem)] w-[340px] overflow-auto rounded-2xl border border-white/10 bg-black/70 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
        <div>
          <h2 className="text-sm font-semibold">图片历史</h2>
          <p className="mt-1 text-xs leading-5 text-white/45">最近生成的作品</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="tapnow-pill !min-h-8 !px-3"
            type="button"
            onClick={onClear}
            title="清空历史"
            disabled={history.length === 0}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button className="tapnow-pill !min-h-8 !px-3" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="p-5 text-sm text-white/45">还没有生成记录。</div>
      ) : (
        <div className="grid gap-3 p-4">
          {history.map((item, index) => (
            <div
              key={item.id}
              className="group grid grid-cols-[72px_1fr] gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-2 text-left transition hover:border-cyan-300/45 hover:bg-white/[0.08]"
            >
              <button
                type="button"
                onClick={() => onRestore(item)}
                className="aspect-square overflow-hidden rounded-lg bg-white/5"
                title="恢复到预览节点"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt="历史图片"
                  className="h-full w-full object-cover"
                />
              </button>
              <div className="min-w-0 py-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-xs font-semibold text-white/85">
                    {item.model}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      downloadImage(item.imageUrl, `generated-${index + 1}.png`)
                    }
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12]"
                    title="保存到本地"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onRestore(item)}
                  className="mt-1 line-clamp-2 text-left text-xs leading-5 text-white/50"
                  title="恢复到预览节点"
                >
                  {item.prompt}
                </button>
                <div className="mt-2 text-[11px] text-white/35">
                  {formatHistoryTime(item.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

export function WorkflowCanvas({ username }: { username?: string }) {
  const {
    nodes,
    edges,
    history,
    error,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    loadHistory,
    clearHistory,
    restoreHistoryItem,
    setRunState,
    setRunResult,
    toWorkflowJson
  } = useWorkflowStore();
  const [panel, setPanel] = useState<"history" | null>(null);
  const [account, setAccount] = useState<AccountState | null>(null);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function refreshAccount() {
    const response = await fetch("/api/account/me", { cache: "no-store" });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (response.ok) {
      setAccount((await response.json()) as AccountState);
    }
  }

  useEffect(() => {
    refreshAccount();
  }, []);

  async function runWorkflow(event?: Event) {
    const generateNodeId =
      event instanceof CustomEvent &&
      typeof event.detail?.generateNodeId === "string"
        ? event.detail.generateNodeId
        : undefined;

    setRunState("running", undefined, generateNodeId);

    try {
      const workflow = toWorkflowJson();
      const response = await fetch("/api/workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...workflow,
          targetGenerateNodeId: generateNodeId
        })
      });
      const payload = (await response.json()) as
        | RunWorkflowResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error ? payload.error : "工作流运行失败。"
        );
      }

      setRunResult(payload as RunWorkflowResponse);
      setPanel("history");
      refreshAccount();
    } catch (runError) {
      setRunState(
        "error",
        runError instanceof Error ? runError.message : "工作流运行失败。",
        generateNodeId
      );
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  useEffect(() => {
    window.addEventListener("workflow-run-request", runWorkflow);

    return () => {
      window.removeEventListener("workflow-run-request", runWorkflow);
    };
  });

  return (
    <div className="tapnow-shell h-screen overflow-hidden text-white">
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-7 py-5">
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="tapnow-logo">
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-wide">创意画布</h1>
            <p className="text-xs text-white/45">AI 图片聚合创作台</p>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {username && (
            <span className="tapnow-pill hidden sm:inline-flex" title="当前登录账号">
              {username}
            </span>
          )}
          {account && (
            <span className="tapnow-pill" title="剩余积分">
              <Coins className="h-4 w-4" />
              {account.user.credits}
            </span>
          )}
          {account?.user.isAdmin && (
            <Link className="tapnow-pill" href="/admin" title="后台管理">
              <Shield className="h-4 w-4" />
            </Link>
          )}
          <button
            className="tapnow-pill"
            type="button"
            onClick={logout}
            title="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {error && (
        <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-full border border-red-400/30 bg-red-500/15 px-4 py-2 text-sm text-red-100 backdrop-blur">
          {error}
        </div>
      )}

      <main className="relative h-full min-h-0">
        <aside className="tapnow-leftbar absolute left-7 top-1/2 z-20 -translate-y-1/2">
          {nodeButtons.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.type}
                className="tapnow-tool"
                type="button"
                onClick={() => addNode(item.type)}
                title={`添加${item.label}节点`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
          <button
            className="tapnow-tool"
            type="button"
            title="历史记录"
            onClick={() => setPanel((value) => (value === "history" ? null : "history"))}
          >
            <History className="h-4 w-4" />
          </button>
        </aside>

        <section className="h-full min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            proOptions={{ hideAttribution: true }}
            className="tapnow-canvas"
          >
            <Controls position="bottom-left" />
          </ReactFlow>
        </section>

        {panel === "history" && (
          <HistoryPanel
            history={history}
            onRestore={restoreHistoryItem}
            onClear={clearHistory}
            onClose={() => setPanel(null)}
          />
        )}
      </main>
    </div>
  );
}
