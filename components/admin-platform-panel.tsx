"use client";

import { useState } from "react";

type AdminOverview = {
  models: Array<{
    id: string;
    name: string;
    enabled: boolean;
    channel: string;
    baseCredits: number;
  }>;
  channels: Array<{
    id: string;
    name: string;
    provider: string;
    baseUrl: string;
    enabled: boolean;
  }>;
  sensitiveWords: string[];
  templates: Array<{
    id: string;
    name: string;
    prompt: string;
  }>;
};

export function AdminPlatformPanel({ initial }: { initial: AdminOverview }) {
  const [models, setModels] = useState(initial.models);
  const [channels, setChannels] = useState(initial.channels);
  const [sensitiveWords, setSensitiveWords] = useState(initial.sensitiveWords.join("\n"));
  const [templatesJson, setTemplatesJson] = useState(
    JSON.stringify(initial.templates, null, 2)
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveConfig() {
    setSaving(true);
    setMessage("");

    try {
      const templates = JSON.parse(templatesJson) as AdminOverview["templates"];
      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          models,
          channels,
          sensitiveWords: sensitiveWords
            .split("\n")
            .map((word) => word.trim())
            .filter(Boolean),
          templates
        })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "保存失败");
      }

      setMessage("已保存配置");
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
            调整模型积分、渠道开关、敏感词和创作模板。
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

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white/75">模型计费</h3>
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
                    value={model.baseCredits}
                    onChange={(event) =>
                      setModels((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, baseCredits: Number(event.currentTarget.value) }
                            : item
                        )
                      )
                    }
                  />
                </label>
              </div>
            ))}
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
