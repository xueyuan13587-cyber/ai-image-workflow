"use client";

import { useState } from "react";

type FeatureKey =
  | "text-to-image"
  | "image-to-image"
  | "reference-image"
  | "inpaint"
  | "outpaint"
  | "upscale"
  | "multi-image-fusion"
  | "batch";

type PricingRules = {
  resolutionMultipliers: Record<"1K" | "2K" | "4K", number>;
  detailMultipliers: Record<"low" | "medium" | "high", number>;
  featureMultipliers: Record<FeatureKey, number>;
};

type ModelConfig = {
  id: string;
  name: string;
  enabled: boolean;
  channel: string;
  baseCredits: number;
  multiplier: number;
  resolutionMultipliers?: PricingRules["resolutionMultipliers"];
  detailMultipliers?: PricingRules["detailMultipliers"];
};

type AdminOverview = {
  models: ModelConfig[];
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

const resolutionKeys = ["1K", "2K", "4K"] as const;
const detailOptions = [
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"]
] as const;
const featureOptions: Array<[FeatureKey, string]> = [
  ["text-to-image", "Text"],
  ["reference-image", "Reference"],
  ["image-to-image", "Image Edit"],
  ["multi-image-fusion", "Fusion"],
  ["inpaint", "Inpaint"],
  ["outpaint", "Outpaint"],
  ["upscale", "Upscale"],
  ["batch", "Batch"]
];

function toSafeCredits(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1;
}

function toSafeMultiplier(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 1;
}

function getResolutionMultiplier(model: ModelConfig, key: "1K" | "2K" | "4K") {
  const fallback = key === "1K" ? 1 : key === "2K" ? 2 : 4;
  return model.resolutionMultipliers?.[key] ?? fallback;
}

function getDetailMultiplier(model: ModelConfig, key: "low" | "medium" | "high") {
  const fallback = key === "low" ? 1 : key === "medium" ? 1.4 : 2;
  return model.detailMultipliers?.[key] ?? fallback;
}

function NumberField({
  label,
  value,
  min = 0.1,
  step = 0.1,
  onChange
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-white/45">
      {label}
      <input
        className="h-9 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none"
        type="number"
        min={min}
        step={step}
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

  function updateModel(index: number, next: Partial<ModelConfig>) {
    setModels((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item))
    );
  }

  function updateModelResolution(
    index: number,
    key: "1K" | "2K" | "4K",
    value: number
  ) {
    setModels((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              resolutionMultipliers: {
                "1K": getResolutionMultiplier(item, "1K"),
                "2K": getResolutionMultiplier(item, "2K"),
                "4K": getResolutionMultiplier(item, "4K"),
                [key]: value
              }
            }
          : item
      )
    );
  }

  function updateModelDetail(
    index: number,
    key: "low" | "medium" | "high",
    value: number
  ) {
    setModels((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              detailMultipliers: {
                low: getDetailMultiplier(item, "low"),
                medium: getDetailMultiplier(item, "medium"),
                high: getDetailMultiplier(item, "high"),
                [key]: value
              }
            }
          : item
      )
    );
  }

  function updateFeature(key: FeatureKey, value: number) {
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
        throw new Error("Template JSON is invalid.");
      }

      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          models: models.map((model) => ({
            ...model,
            baseCredits: Math.max(1, Math.round(Number(model.baseCredits) || 1)),
            multiplier: toSafeMultiplier(String(model.multiplier)),
            resolutionMultipliers: {
              "1K": toSafeMultiplier(String(model.resolutionMultipliers?.["1K"] ?? 1)),
              "2K": toSafeMultiplier(String(model.resolutionMultipliers?.["2K"] ?? 2)),
              "4K": toSafeMultiplier(String(model.resolutionMultipliers?.["4K"] ?? 4))
            },
            detailMultipliers: {
              low: toSafeMultiplier(String(model.detailMultipliers?.low ?? 1)),
              medium: toSafeMultiplier(String(model.detailMultipliers?.medium ?? 1.4)),
              high: toSafeMultiplier(String(model.detailMultipliers?.high ?? 2))
            }
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
        throw new Error(payload.error ?? "Save failed.");
      }

      if (payload.models) setModels(payload.models);
      if (payload.channels) setChannels(payload.channels);
      if (payload.pricingRules) setPricingRules(payload.pricingRules);
      if (payload.sensitiveWords) setSensitiveWords(payload.sensitiveWords.join("\n"));
      if (payload.templates) setTemplatesJson(JSON.stringify(payload.templates, null, 2));

      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Pricing Config</h2>
          <p className="mt-1 text-sm text-white/42">
            Each model has its own resolution and quality multipliers.
          </p>
        </div>
        <button className="tapnow-run" type="button" onClick={saveConfig} disabled={saving}>
          {saving ? "Saving" : "Save"}
        </button>
      </div>

      {message && <div className="mt-3 text-sm text-cyan-200">{message}</div>}

      <div className="mt-5 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white/75">Per Model Pricing</h3>
          <div className="grid gap-3">
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
                        updateModel(index, { enabled: event.currentTarget.checked })
                      }
                    />
                    Enabled
                  </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs text-white/45">
                    Base Credits
                    <input
                      className="h-9 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none"
                      type="number"
                      min={1}
                      step={1}
                      value={model.baseCredits}
                      onChange={(event) =>
                        updateModel(index, {
                          baseCredits: toSafeCredits(event.currentTarget.value)
                        })
                      }
                    />
                  </label>
                  <NumberField
                    label="Model Multiplier"
                    value={model.multiplier}
                    onChange={(value) => updateModel(index, { multiplier: value })}
                  />
                </div>

                <div className="mt-4 rounded-lg border border-white/10 bg-black/15 p-3">
                  <div className="mb-3 text-xs font-semibold text-white/60">
                    Resolution multipliers for this model
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {resolutionKeys.map((resolution) => (
                      <NumberField
                        key={resolution}
                        label={resolution}
                        value={getResolutionMultiplier(model, resolution)}
                        onChange={(value) => updateModelResolution(index, resolution, value)}
                      />
                    ))}
                  </div>

                  <div className="mb-3 mt-4 text-xs font-semibold text-white/60">
                    Quality multipliers for this model
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {detailOptions.map(([detail, label]) => (
                      <NumberField
                        key={detail}
                        label={label}
                        value={getDetailMultiplier(model, detail)}
                        onChange={(value) => updateModelDetail(index, detail, value)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white/75">Feature Multipliers</h3>
          <div className="grid gap-3 rounded-lg border border-white/10 p-3 sm:grid-cols-2">
            {featureOptions.map(([key, label]) => (
              <NumberField
                key={key}
                label={label}
                value={pricingRules.featureMultipliers[key]}
                onChange={(value) => updateFeature(key, value)}
              />
            ))}
          </div>

          <h3 className="mb-3 mt-5 text-sm font-semibold text-white/75">Channels</h3>
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

          <h3 className="mb-3 mt-5 text-sm font-semibold text-white/75">Sensitive Words</h3>
          <textarea
            className="min-h-28 w-full rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-white outline-none"
            value={sensitiveWords}
            onChange={(event) => setSensitiveWords(event.currentTarget.value)}
            placeholder="One word per line"
          />

          <h3 className="mb-3 mt-5 text-sm font-semibold text-white/75">Template JSON</h3>
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
