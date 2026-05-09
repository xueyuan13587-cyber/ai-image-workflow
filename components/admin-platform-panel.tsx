"use client";

import { useState } from "react";

type PricingRules = {
  resolutionMultipliers: Record<"1K" | "2K" | "4K", number>;
  detailMultipliers: Record<"low" | "medium" | "high", number>;
  featureMultipliers: Record<
    | "text-to-image"
    | "image-to-image"
    | "reference-image"
    | "inpaint"
    | "outpaint"
    | "upscale"
    | "multi-image-fusion"
    | "batch",
    number
  >;
};

type AdminOverview = {
  models: Array<{
    id: string;
    name: string;
    enabled: boolean;
    channel: string;
    baseCredits: number;
    multiplier: number;
  }>;
  channels: Array<{
    id: string;
    name: string;
    provider: string;
    baseUrl: string;
    enabled: boolean;
  }>;
  pricingRules: PricingRules;
  sensitiveWords: string[];
  templates: Array<{
    id: string;
    name: string;
    prompt: string;
  }>;
};

function toSafeCredits(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.round(parsed));
}

function toSafeMultiplier(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.round(parsed * 100) / 100;
}

function MultiplierInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-white/45">
      {label}
      <input
        className="h-9 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none"
        type="number"
        min={0.1}
        step={0.1}
        value={value}
        onChange={(event) => onChange(toSafeMultiplier(event.currentTarget.value))}
      />
    </label>
  );
}

export function AdminPlatformPanel({ initial }: { initial: AdminOverview }) {
  const [models, setModels] = useState(initial.models);
  const [channels, setChannels] = useState(initial.channels);
  const [pricingRules, setPricingRules] = useState(initial.pricingRules);
  const [sensitiveWords, setSensitiveWords] = useState(initial.sensitiveWords.join("\n"));
  const [templatesJson, setTemplatesJson] = useState(
    JSON.stringify(initial.templates, null, 2)
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function updateResolution(key: keyof PricingRules["resolutionMultipliers"], value: number) {
    setPricingRules((rules) => ({
      ...rules,
      resolutionMultipliers: {
        ...rules.resolutionMultipliers,
        [key]: value
      }
    }));
  }

  function updateDetail(key: keyof PricingRules["detailMultipliers"], value: number) {
    setPricingRules((rules) => ({
      ...rules,
      detailMultipliers: {
        ...rules.detailMultipliers,
        [key]: value
      }
    }));
  }

  function updateFeature(key: keyof PricingRules["featureMultipliers"], value: number) {
    setPricingRules((rules) => ({
      ...rules,
      featureMultipliers: {
        ...rules.featureMultipliers,
        [key]: value
      }
    }));
  }

  async function saveConfig() {
    setSaving(true);
    setMessage("");

    try {
      let templates: AdminOverview["templates"];

      try {
        templates = JSON.parse(templatesJson) as AdminOverview["templates"];
      } catch {
        throw new Error("模板 JSON 格式不正确，请检查逗号、引号和括号。");
      }

      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          models: models.map((model) => ({
            ...model,
            baseCredits: Math.max(1, Math.round(Number(model.baseCredits) || 1)),
            multiplier: toSafeMultiplier(String(model.multiplier))
          })),
          channels,
          pricingRules,
          sensitiveWords: sensitiveWords
            .split("\n")
            .map((word) => word.trim())
            .filter(Boolean),
          templates
        })
      });
      const payload = (await response.json()) as Partial<AdminOverview> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "保存失败");
      }

      if (payload.models) setModels(payload.models);
      if (payload.channels) setChannels(payload.channels);
      if (payload.pricingRules) setPricingRules(payload.pricingRules);
      if (payload.sensitiveWords) setSensitiveWords(payload.sensitiveWords.join("\n"));
      if (payload.templates) setTemplatesJson(JSON.stringify(payload.templates, null, 2));

      setMessage("配置已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">平台配置</h2>
          <p className="mt-1 text-sm text-white/42">
            模型基础积分乘以分辨率、质量、功能和张数，得到最终扣费。
          </p>
        </div>
        <button
          className="tapnow-run"
          type="button"
          onClick={saveConfig}
          disabled={saving}
        >
          {saving ? "保存中" : "保存配置"}
        </button>
      </div>

      {message && <div className="mt-3 text-sm text-cyan-200">{message}</div>}

      <div className="mt-5 grid gap-6 xl:grid-cols-3">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white/75">模型基础积分</h3>
          <div className="grid gap-2">
            {models.map((model, index) => (
              <div key={model.id} className="rounded-lg border border-white/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{model.name}</div>
                    <div className="text-xs text-white/35">{model.id}</div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white/55">
                    <input
                      type="checkbox"
                      checked={model.enabled}
                      onChange={(event) =>
                        setModels((items) =>
                          items.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, enabled: event.currentTarget.checked }
                              : item
                          )
                        )
                      }
                    />
                    启用
                  </label>
                </div>
                <label className="mt-3 grid gap-1 text-xs text-white/45">
                  基础积分
                  <input
                    className="h-9 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none"
                    type="number"
                    min={1}
                    step={1}
                    value={model.baseCredits}
                    onChange={(event) => {
                      const nextCredits = toSafeCredits(event.currentTarget.value);

                      setModels((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, baseCredits: nextCredits }
                            : item
                        )
                      );
                    }}
                  />
                </label>
                <label className="mt-3 grid gap-1 text-xs text-white/45">
                  模型倍率
                  <input
                    className="h-9 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={model.multiplier}
                    onChange={(event) => {
                      const multiplier = toSafeMultiplier(event.currentTarget.value);

                      setModels((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, multiplier } : item
                        )
                      );
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white/75">参数倍率</h3>
          <div className="grid gap-3 rounded-lg border border-white/10 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <MultiplierInput
                label="1K"
                value={pricingRules.resolutionMultipliers["1K"]}
                onChange={(value) => updateResolution("1K", value)}
              />
              <MultiplierInput
                label="2K"
                value={pricingRules.resolutionMultipliers["2K"]}
                onChange={(value) => updateResolution("2K", value)}
              />
              <MultiplierInput
                label="4K"
                value={pricingRules.resolutionMultipliers["4K"]}
                onChange={(value) => updateResolution("4K", value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MultiplierInput
                label="低质量"
                value={pricingRules.detailMultipliers.low}
                onChange={(value) => updateDetail("low", value)}
              />
              <MultiplierInput
                label="中质量"
                value={pricingRules.detailMultipliers.medium}
                onChange={(value) => updateDetail("medium", value)}
              />
              <MultiplierInput
                label="高质量"
                value={pricingRules.detailMultipliers.high}
                onChange={(value) => updateDetail("high", value)}
              />
            </div>
          </div>

          <h3 className="mb-3 mt-5 text-sm font-semibold text-white/75">功能倍率</h3>
          <div className="grid gap-3 rounded-lg border border-white/10 p-3 sm:grid-cols-2">
            <MultiplierInput
              label="文生图"
              value={pricingRules.featureMultipliers["text-to-image"]}
              onChange={(value) => updateFeature("text-to-image", value)}
            />
            <MultiplierInput
              label="添加参考图"
              value={pricingRules.featureMultipliers["reference-image"]}
              onChange={(value) => updateFeature("reference-image", value)}
            />
            <MultiplierInput
              label="图生图"
              value={pricingRules.featureMultipliers["image-to-image"]}
              onChange={(value) => updateFeature("image-to-image", value)}
            />
            <MultiplierInput
              label="多图融合"
              value={pricingRules.featureMultipliers["multi-image-fusion"]}
              onChange={(value) => updateFeature("multi-image-fusion", value)}
            />
            <MultiplierInput
              label="局部重绘"
              value={pricingRules.featureMultipliers.inpaint}
              onChange={(value) => updateFeature("inpaint", value)}
            />
            <MultiplierInput
              label="扩图"
              value={pricingRules.featureMultipliers.outpaint}
              onChange={(value) => updateFeature("outpaint", value)}
            />
            <MultiplierInput
              label="高清放大"
              value={pricingRules.featureMultipliers.upscale}
              onChange={(value) => updateFeature("upscale", value)}
            />
            <MultiplierInput
              label="批量生成"
              value={pricingRules.featureMultipliers.batch}
              onChange={(value) => updateFeature("batch", value)}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white/75">渠道开关</h3>
          <div className="grid gap-2">
            {channels.map((channel, index) => (
              <div key={channel.id} className="rounded-lg border border-white/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{channel.name}</div>
                    <div className="break-all text-xs text-white/35">{channel.baseUrl}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={channel.enabled}
                    onChange={(event) =>
                      setChannels((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, enabled: event.currentTarget.checked }
                            : item
                        )
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <h3 className="mb-3 mt-5 text-sm font-semibold text-white/75">敏感词</h3>
          <textarea
            className="min-h-28 w-full rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-white outline-none"
            value={sensitiveWords}
            onChange={(event) => setSensitiveWords(event.currentTarget.value)}
            placeholder="一行一个敏感词"
          />

          <h3 className="mb-3 mt-5 text-sm font-semibold text-white/75">模板 JSON</h3>
          <textarea
            className="min-h-36 w-full rounded-lg border border-white/10 bg-black/25 p-3 font-mono text-xs text-white outline-none"
            value={templatesJson}
            onChange={(event) => setTemplatesJson(event.currentTarget.value)}
          />
        </div>
      </div>
    </section>
  );
}
