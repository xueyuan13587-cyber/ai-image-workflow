import Link from "next/link";
import { ArrowRight, BadgePlus, ImagePlus, Sparkles, Wand2 } from "lucide-react";

import { AppTopNav } from "@/modules/workspace/components/app-top-nav";
import { requireSession } from "@/modules/auth/server/server-session";

const templates = [
  {
    title: "高级产品摄影",
    desc: "适合商品主图、详情页首图和品牌视觉。",
    icon: ImagePlus,
    className: "from-cyan-300/26 via-white/12 to-zinc-950"
  },
  {
    title: "角色四宫格",
    desc: "参考图拆分角色，生成白底多宫格设定图。",
    icon: BadgePlus,
    className: "from-violet-300/28 via-sky-300/12 to-zinc-950"
  },
  {
    title: "苹果广告风",
    desc: "极简留白、干净阴影、精致产品展示。",
    icon: Sparkles,
    className: "from-white/30 via-emerald-200/14 to-zinc-950"
  },
  {
    title: "潮玩盲盒",
    desc: "泡泡玛特、潮玩、粘土质感和收藏级摄影。",
    icon: Wand2,
    className: "from-rose-300/28 via-amber-200/14 to-zinc-950"
  }
];

export default async function TemplatesPage() {
  const session = await requireSession();

  return (
    <div className="min-h-screen bg-[#08090b] text-white">
      <AppTopNav username={session.username} />

      <main className="mx-auto max-w-[1380px] px-6 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/42">模板库</p>
            <h1 className="mt-2 text-4xl font-semibold">选择一个模板开始创作</h1>
          </div>
          <Link
            href="/workspace"
            className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/18"
          >
            打开工作空间
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {templates.map((template) => {
            const Icon = template.icon;

            return (
              <Link
                key={template.title}
                href="/workspace"
                className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] transition hover:border-white/18 hover:bg-white/[0.075]"
              >
                <div className={`h-52 bg-gradient-to-br ${template.className}`} />
                <div className="p-5">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.08] text-white/75">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{template.title}</h2>
                    <ArrowRight className="h-4 w-4 text-white/38 transition group-hover:translate-x-1 group-hover:text-white" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/45">{template.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
