"use client";

import "@xyflow/react/dist/style.css";

import { Controls, ReactFlow, type NodeTypes } from "@xyflow/react";
import Link from "next/link";
import {
  Coins,
  Download,
  History,
  Image as ImageIcon,
  ImagePlus,
  LogOut,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  Star,
  Trash2
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ImageGenerateNode } from "@/modules/workflow/components/nodes/image-generate-node";
import { ImagePreviewNode } from "@/modules/workflow/components/nodes/image-preview-node";
import { ReferenceImageNode } from "@/modules/workflow/components/nodes/reference-image-node";
import { StylePresetNode } from "@/modules/workflow/components/nodes/style-preset-node";
import { TextPromptNode } from "@/modules/workflow/components/nodes/text-prompt-node";
import { downloadImage } from "@/modules/assets/utils/download-image";
import { useWorkflowStore } from "@/modules/workflow/store/workflow-store";
import type {
  ImageAsset,
  ImageHistoryItem,
  QueuedWorkflowResponse,
  RunWorkflowResponse,
  WorkflowJson,
  WorkflowNode
} from "@/types/workflow";

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

type RechargePlan = {
  id: string;
  name: string;
  credits: number;
  bonusCredits?: number;
  priceCny: number;
  description?: string;
};

type RechargeOrder = {
  id: string;
  planName: string;
  totalCredits: number;
  priceCny: number;
  status: "pending" | "paid" | "rejected";
  createdAt: string;
  paymentNote?: string;
};

type GenerationTaskDetail = {
  id: string;
  status: "pending" | "processing" | "success" | "failed";
  feature: string;
  costCredits: number;
  refundedCredits?: number;
  error?: string;
  prompt: string;
  result?: {
    imageUrl: string;
    images?: Array<{
      imageUrl: string;
      mimeType: string;
    }>;
    mimeType: string;
    provider: "openai";
    model: string;
  };
};

type AssetScope = "works" | "history" | "favorites" | "downloads" | "trash";

const assetTabs: Array<{ scope: AssetScope; label: string }> = [
  { scope: "works", label: "我的作品" },
  { scope: "history", label: "历史记录" },
  { scope: "favorites", label: "收藏夹" },
  { scope: "downloads", label: "下载记录" },
  { scope: "trash", label: "回收站" }
];

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

function AssetPanel({
  scope,
  assets,
  loading,
  message,
  onScopeChange,
  onRestore,
  onDownload,
  onToggleFavorite,
  onDelete,
  onRestoreDeleted,
  onClose
}: {
  scope: AssetScope;
  assets: ImageAsset[];
  loading: boolean;
  message: string;
  onScopeChange: (scope: AssetScope) => void;
  onRestore: (asset: ImageAsset) => void;
  onDownload: (asset: ImageAsset) => void;
  onToggleFavorite: (asset: ImageAsset) => void;
  onDelete: (asset: ImageAsset) => void;
  onRestoreDeleted: (asset: ImageAsset) => void;
  onClose: () => void;
}) {
  return (
    <aside className="absolute left-24 top-24 z-30 flex max-h-[calc(100vh-8rem)] w-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/75 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
        <div>
          <h2 className="text-sm font-semibold">图片资产</h2>
          <p className="mt-1 text-xs leading-5 text-white/45">作品、收藏、下载和回收站都会保存在账号下</p>
        </div>
        <button className="tapnow-pill !min-h-8 !px-3" type="button" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-3">
        {assetTabs.map((tab) => (
          <button
            key={tab.scope}
            type="button"
            onClick={() => onScopeChange(tab.scope)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition ${
              scope === tab.scope
                ? "bg-white text-black"
                : "bg-white/[0.06] text-white/55 hover:bg-white/[0.12] hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <div className="mx-4 mt-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100">
          {message}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {loading && assets.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 text-sm text-white/45">
            正在加载资产...
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 text-sm text-white/45">
            这里还没有图片。
          </div>
        ) : (
          <div className="grid gap-3">
            {assets.map((asset, index) => (
              <div
                key={asset.id}
                className="grid grid-cols-[86px_1fr] gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-2 transition hover:border-cyan-300/45 hover:bg-white/[0.08]"
              >
                <button
                  type="button"
                  onClick={() => onRestore(asset)}
                  className="aspect-square overflow-hidden rounded-lg bg-white/5"
                  title="放到预览节点"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.imageUrl}
                    alt="资产图片"
                    className="h-full w-full object-cover"
                  />
                </button>
                <div className="min-w-0 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-white/85">
                        {asset.model}
                      </div>
                      <div className="mt-1 text-[11px] text-white/35">
                        {formatHistoryTime(asset.createdAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {scope !== "trash" && (
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(asset)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12]"
                          title={asset.favorite ? "取消收藏" : "收藏"}
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${
                              asset.favorite ? "fill-yellow-300 text-yellow-300" : ""
                            }`}
                          />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDownload(asset)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12]"
                        title="下载到本地"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      {scope === "trash" ? (
                        <button
                          type="button"
                          onClick={() => onRestoreDeleted(asset)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12]"
                          title="恢复"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDelete(asset)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-red-400/15 hover:text-red-100"
                          title="删除到回收站"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRestore(asset)}
                    className="mt-2 line-clamp-2 text-left text-xs leading-5 text-white/55"
                    title="放到预览节点"
                  >
                    {asset.originalPrompt || asset.prompt}
                  </button>

                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-white/38">
                    {asset.parameters.aspectRatio && <span>{asset.parameters.aspectRatio}</span>}
                    {asset.parameters.resolution && <span>{asset.parameters.resolution}</span>}
                    {asset.parameters.detail && <span>{asset.parameters.detail}</span>}
                    {asset.parameters.count && <span>{asset.parameters.count} 张</span>}
                    {typeof asset.parameters.costCredits === "number" && (
                      <span>{asset.parameters.costCredits} 积分</span>
                    )}
                    {asset.referenceImages.length > 0 && (
                      <span>参考图 {asset.referenceImages.length}</span>
                    )}
                    {asset.downloadedAt && <span>已下载</span>}
                    <span>#{index + 1}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function RechargePanel({
  plans,
  orders,
  loading,
  message,
  onCreateOrder,
  onClose
}: {
  plans: RechargePlan[];
  orders: RechargeOrder[];
  loading: boolean;
  message: string;
  onCreateOrder: (planId: string) => void;
  onClose: () => void;
}) {
  const statusLabel = {
    pending: "待确认",
    paid: "已到账",
    rejected: "已拒绝"
  };

  return (
    <aside className="absolute right-7 top-24 z-30 w-[380px] rounded-2xl border border-white/10 bg-black/75 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
        <div>
          <h2 className="text-sm font-semibold">积分充值</h2>
          <p className="mt-1 text-xs text-white/45">提交订单后等待管理员确认到账。</p>
        </div>
        <button className="tapnow-pill !min-h-8 !px-3" type="button" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="grid gap-3 p-4">
        {message && (
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100">
            {message}
          </div>
        )}

        {loading && plans.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm text-white/45">
            充值套餐加载中...
          </div>
        )}

        {!loading && plans.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm text-white/45">
            暂无可用充值套餐，请联系管理员在后台配置。
          </div>
        )}

        {plans.map((plan) => (
          <div key={plan.id} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{plan.name}</div>
                <div className="mt-1 text-xs text-white/45">{plan.description}</div>
                <div className="mt-2 text-xs text-white/60">
                  到账 {plan.credits} 积分
                  {plan.bonusCredits ? ` + 赠送 ${plan.bonusCredits}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-white/38">充值金额</div>
                <div className="text-lg font-semibold">CNY {plan.priceCny}</div>
                <button
                  className="tapnow-run mt-2 !min-h-9 !px-4"
                  type="button"
                  disabled={loading}
                  onClick={() => onCreateOrder(plan.id)}
                >
                  {loading ? "提交中" : "充值"}
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="mt-2 border-t border-white/10 pt-4">
          <div className="mb-3 text-xs font-semibold text-white/60">我的充值订单</div>
          {orders.length === 0 ? (
            <div className="text-xs text-white/38">还没有充值订单。</div>
          ) : (
            <div className="grid max-h-56 gap-2 overflow-auto pr-1">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white/85">{order.planName}</span>
                    <span className="rounded-full bg-white/[0.08] px-2 py-1 text-white/55">
                      {statusLabel[order.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-white/45">
                    CNY {order.priceCny} · {order.totalCredits} 积分
                  </div>
                  <div className="mt-1 text-white/30">{formatHistoryTime(order.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function projectWorkflowKey(projectId: string) {
  return `ai-image-workflow-project-${projectId}`;
}

function projectsListKey() {
  return "ai-image-workflow-projects";
}

function readProjectName(projectId?: string) {
  if (!projectId || typeof window === "undefined") return "工作空间";

  try {
    const raw = window.localStorage.getItem(projectsListKey());
    const projects = raw ? (JSON.parse(raw) as Array<{ id: string; name: string }>) : [];
    return projects.find((project) => project.id === projectId)?.name ?? "项目画布";
  } catch {
    return "项目画布";
  }
}

function touchProject(projectId: string) {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(projectsListKey());
    const projects = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    const nextProjects = projects.map((project) =>
      project.id === projectId ? { ...project, updatedAt: new Date().toISOString() } : project
    );
    window.localStorage.setItem(projectsListKey(), JSON.stringify(nextProjects));
  } catch {
    // Project list is a convenience layer; workflow saving should not fail because of it.
  }
}

export function WorkflowCanvas({
  username,
  projectId
}: {
  username?: string;
  projectId?: string;
}) {
  const {
    nodes,
    edges,
    history,
    runState,
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
    loadWorkflow,
    toWorkflowJson
  } = useWorkflowStore();
  const [panel, setPanel] = useState<"history" | "recharge" | "assets" | null>(null);
  const [account, setAccount] = useState<AccountState | null>(null);
  const [rechargePlans, setRechargePlans] = useState<RechargePlan[]>([]);
  const [rechargeOrders, setRechargeOrders] = useState<RechargeOrder[]>([]);
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [rechargeLoaded, setRechargeLoaded] = useState(false);
  const [rechargeMessage, setRechargeMessage] = useState("");
  const [assetScope, setAssetScope] = useState<AssetScope>("works");
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsMessage, setAssetsMessage] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("工作空间");
  const workflowLoadedRef = useRef(false);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    workflowLoadedRef.current = false;
  }, [projectId]);

  useEffect(() => {
    if (!projectId || typeof window === "undefined") {
      workflowLoadedRef.current = true;
      setProjectName("工作空间");
      return;
    }

    setProjectName(readProjectName(projectId));

    try {
      const raw = window.localStorage.getItem(projectWorkflowKey(projectId));
      if (raw) {
        loadWorkflow(JSON.parse(raw) as WorkflowJson);
      }
    } catch {
      window.localStorage.removeItem(projectWorkflowKey(projectId));
    } finally {
      workflowLoadedRef.current = true;
    }
  }, [loadWorkflow, projectId]);

  useEffect(() => {
    if (!projectId || !workflowLoadedRef.current || typeof window === "undefined") return;

    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(
        projectWorkflowKey(projectId),
        JSON.stringify({ version: "1.0", nodes, edges } satisfies WorkflowJson)
      );
      touchProject(projectId);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [edges, nodes, projectId]);

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

  async function loadRecharge() {
    setRechargeLoading(true);

    try {
      const [plansResponse, ordersResponse] = await Promise.all([
        fetch("/api/recharge/plans", { cache: "no-store" }),
        fetch("/api/recharge/orders", { cache: "no-store" })
      ]);

      if (plansResponse.ok) {
        const payload = (await plansResponse.json()) as { plans?: RechargePlan[] };
        setRechargePlans(payload.plans ?? []);
      }

      if (ordersResponse.ok) {
        const payload = (await ordersResponse.json()) as { orders?: RechargeOrder[] };
        setRechargeOrders(payload.orders ?? []);
      }
      setRechargeLoaded(true);
    } finally {
      setRechargeLoading(false);
    }
  }

  useEffect(() => {
    if (account && !rechargeLoaded && !rechargeLoading) {
      void loadRecharge();
    }
  }, [account, rechargeLoaded, rechargeLoading]);

  async function openRechargePanel() {
    setPanel((value) => (value === "recharge" ? null : "recharge"));
    setRechargeMessage("");
    if (!rechargeLoaded && !rechargeLoading) {
      void loadRecharge();
    }
  }

  async function loadAssets(scope: AssetScope = assetScope) {
    setAssetsLoading(true);
    setAssetsMessage("");

    try {
      const response = await fetch(`/api/assets?scope=${scope}`, { cache: "no-store" });
      const payload = (await response.json()) as { assets?: ImageAsset[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "加载图片资产失败。");
      }

      setAssets(payload.assets ?? []);
    } catch (error) {
      setAssetsMessage(error instanceof Error ? error.message : "加载图片资产失败。");
    } finally {
      setAssetsLoading(false);
    }
  }

  function openAssetsPanel(scope: AssetScope = assetScope) {
    setAssetScope(scope);
    setPanel((value) => (value === "assets" ? null : "assets"));
    void loadAssets(scope);
  }

  function changeAssetScope(scope: AssetScope) {
    setAssetScope(scope);
    void loadAssets(scope);
  }

  async function updateAssetAction(
    asset: ImageAsset,
    action: "favorite" | "unfavorite" | "delete" | "restore" | "download"
  ) {
    const response = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = (await response.json()) as { asset?: ImageAsset; error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "资产操作失败。");
    }

    await loadAssets(assetScope);
    return payload.asset;
  }

  async function downloadAsset(asset: ImageAsset) {
    try {
      await updateAssetAction(asset, "download");
      await downloadImage(asset.imageUrl, `asset-${asset.id}.png`);
      setAssetsMessage("已开始下载，并记录到下载记录。");
    } catch (error) {
      setAssetsMessage(error instanceof Error ? error.message : "下载失败。");
    }
  }

  function restoreAssetToPreview(asset: ImageAsset) {
    restoreHistoryItem({
      id: asset.id,
      imageUrl: asset.imageUrl,
      prompt: asset.originalPrompt || asset.prompt,
      model: asset.model,
      createdAt: asset.createdAt
    });
  }

  async function pollQueuedTask(
    taskId: string,
    workflow: RunWorkflowResponse["workflow"],
    generateNodeId?: string
  ) {
    const maxPolls = Number(process.env.NEXT_PUBLIC_TASK_POLL_MAX ?? 180);

    for (let attempt = 0; attempt < maxPolls; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt < 2 ? 1200 : 2500));

      const response = await fetch(`/api/tasks/${taskId}`, { cache: "no-store" });
      const payload = (await response.json()) as {
        task?: GenerationTaskDetail;
        error?: string;
      };

      if (!response.ok || !payload.task) {
        throw new Error(payload.error ?? "读取任务状态失败。");
      }

      if (payload.task.status === "failed") {
        throw new Error(payload.task.error ?? "图片任务失败，积分已自动退回。");
      }

      if (payload.task.status !== "success") {
        continue;
      }

      if (!payload.task.result?.imageUrl) {
        throw new Error("任务成功但没有返回图片。");
      }

      return {
        workflow,
        task: {
          id: payload.task.id,
          status: payload.task.status,
          feature: payload.task.feature,
          costCredits: payload.task.costCredits,
          refundedCredits: payload.task.refundedCredits
        },
        result: {
          imageUrl: payload.task.result.imageUrl,
          images: payload.task.result.images,
          mimeType: payload.task.result.mimeType,
          prompt: payload.task.prompt,
          generateNodeId,
          provider: payload.task.result.provider,
          model: payload.task.result.model
        }
      } satisfies RunWorkflowResponse;
    }

    throw new Error("图片任务仍在排队或生成中，请稍后在历史记录里查看。");
  }

  async function toggleFavoriteAsset(asset: ImageAsset) {
    try {
      await updateAssetAction(asset, asset.favorite ? "unfavorite" : "favorite");
    } catch (error) {
      setAssetsMessage(error instanceof Error ? error.message : "收藏操作失败。");
    }
  }

  async function deleteAsset(asset: ImageAsset) {
    try {
      await updateAssetAction(asset, "delete");
      setAssetsMessage("已移入回收站。");
    } catch (error) {
      setAssetsMessage(error instanceof Error ? error.message : "删除失败。");
    }
  }

  async function restoreDeletedAsset(asset: ImageAsset) {
    try {
      await updateAssetAction(asset, "restore");
      setAssetsMessage("已恢复到我的作品。");
    } catch (error) {
      setAssetsMessage(error instanceof Error ? error.message : "恢复失败。");
    }
  }

  async function createRechargeOrder(planId: string) {
    setRechargeLoading(true);
    setRechargeMessage("");

    try {
      const response = await fetch("/api/recharge/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId })
      });
      const payload = (await response.json()) as {
        error?: string;
        order?: RechargeOrder;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "创建充值订单失败。");
      }

      setRechargeMessage("充值订单已提交，请联系管理员确认收款后到账。");
      await loadRecharge();
    } catch (error) {
      setRechargeMessage(error instanceof Error ? error.message : "创建充值订单失败。");
    } finally {
      setRechargeLoading(false);
    }
  }

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
        | QueuedWorkflowResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error ? payload.error : "工作流运行失败。"
        );
      }

      const runPayload = payload as QueuedWorkflowResponse;

      if (typeof runPayload.billing?.creditsAfter === "number") {
        setAccount((current) =>
          current
            ? {
                ...current,
                user: {
                  ...current.user,
                  credits: runPayload.billing?.creditsAfter ?? current.user.credits
                }
              }
            : current
        );
      }

      if (!runPayload.task?.id) {
        throw new Error("任务已提交，但没有返回任务 ID。");
      }

      setActiveTaskId(runPayload.task.id);
      const completedPayload = await pollQueuedTask(
        runPayload.task.id,
        runPayload.workflow,
        generateNodeId
      );

      setRunResult(completedPayload);
      setActiveTaskId(null);
      setAssetScope("history");
      setPanel("assets");
      await loadAssets("history");
      await refreshAccount();
    } catch (runError) {
      setActiveTaskId(null);
      setRunState(
        "error",
        runError instanceof Error ? runError.message : "工作流运行失败。",
        generateNodeId
      );
      await refreshAccount();
    }
  }

  async function cancelActiveTask() {
    if (!activeTaskId) return;

    try {
      await fetch(`/api/tasks/${activeTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" })
      });
      setRunState("error", "已提交取消请求，若任务尚未完成会自动退回积分。");
      setActiveTaskId(null);
      await refreshAccount();
    } catch {
      setRunState("error", "取消任务失败，请稍后再试。");
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
        <span className="sr-only">{projectName}</span>
        <Link
          href="/workspace"
          className="pointer-events-auto flex items-center gap-3 rounded-2xl px-2 py-1 transition hover:bg-white/[0.07]"
          title="返回主页"
        >
          <div className="tapnow-logo">
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-wide">创意画布</h1>
            <p className="text-xs text-white/45">AI 图片聚合创作台</p>
          </div>
        </Link>
        <div className="hidden">
          <Link className="tapnow-pill" href="/">
            主页
          </Link>
          <Link className="tapnow-pill" href="/templates">
            模板库
          </Link>
          <Link className="tapnow-pill bg-white/[0.12] text-white" href="/workspace">
            创意画布
          </Link>
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
          <button
            className="tapnow-pill"
            type="button"
            onClick={openRechargePanel}
            title="积分充值"
          >
            <Plus className="h-4 w-4" />
            充值
          </button>
          {activeTaskId && runState === "running" && (
            <button
              className="tapnow-pill"
              type="button"
              onClick={cancelActiveTask}
              title="取消当前图片任务"
            >
              取消任务
            </button>
          )}
          <a className="tapnow-pill" href="/admin" title="后台管理">
            <Shield className="h-4 w-4" />
            后台
          </a>
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
            onClick={() => openAssetsPanel("works")}
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

        {panel === "assets" && (
          <AssetPanel
            scope={assetScope}
            assets={assets}
            loading={assetsLoading}
            message={assetsMessage}
            onScopeChange={changeAssetScope}
            onRestore={restoreAssetToPreview}
            onDownload={downloadAsset}
            onToggleFavorite={toggleFavoriteAsset}
            onDelete={deleteAsset}
            onRestoreDeleted={restoreDeletedAsset}
            onClose={() => setPanel(null)}
          />
        )}

        {panel === "recharge" && (
          <RechargePanel
            plans={rechargePlans}
            orders={rechargeOrders}
            loading={rechargeLoading}
            message={rechargeMessage}
            onCreateOrder={createRechargeOrder}
            onClose={() => setPanel(null)}
          />
        )}
      </main>
    </div>
  );
}
