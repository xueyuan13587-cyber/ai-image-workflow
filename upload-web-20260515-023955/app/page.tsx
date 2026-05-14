import Link from "next/link";
import { ArrowRight, Images, Layers3, Sparkles, Wand2 } from "lucide-react";

import { AppTopNav } from "@/modules/workspace/components/app-top-nav";
import { requireSession } from "@/modules/auth/server/server-session";

const featureItems = [
  { label: "文生图", icon: Sparkles },
  { label: "图生图", icon: Images },
  { label: "参考图生成", icon: Layers3 },
  { label: "多图融合", icon: Wand2 }
];

const showcase = [
  {
    title: "产品摄影工作流",
    desc: "参考图、提示词、模型和比例都在节点里完成。",
    className: "from-cyan-300/30 via-white/12 to-slate-900"
  },
  {
    title: "角色四宫格模板",
    desc: "适合拆分人物、潮玩、IP 设定和批量生成。",
    className: "from-fuchsia-300/30 via-indigo-300/16 to-slate-900"
  },
  {
    title: "广告海报生成",
    desc: "快速组合风格、尺寸、质量和参考图。",
    className: "from-amber-200/30 via-rose-300/14 to-slate-900"
  }
];

export default async function HomePage() {
  const session = await requireSession();

  return (
    <div className="min-h-screen bg-[#08090b] text-white">
      <AppTopNav username={session.username} />

      <main className="mx-auto max-w-[1380px] px-6 py-8">
        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Link
            href="/workspace"
            className="group relative min-h-[360px] overflow-hidden rounded-3xl border border-white/10 bg-[url('https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />
            <div className="relative flex h-full flex-col justify-end p-7">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs text-white/76 backdrop-blur">
                工作空间
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
              </div>
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight md:text-5xl">
                用节点工作流生成、管理和复用你的 AI 图片资产
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/62">
                从文生图、图生图到参考图生成，模型、比例、质量、积分和历史作品都集中在一个创作台里。
              </p>
            </div>
          </Link>

          <div className="grid gap-4">
            <Link
              href="/templates"
              className="group rounded-3xl border border-white/10 bg-white/[0.055] p-6 transition hover:bg-white/[0.08]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/45">模板库</p>
                  <h2 className="mt-2 text-2xl font-semibold">从模板开始创作</h2>
                </div>
                <ArrowRight className="h-5 w-5 text-white/45 transition group-hover:translate-x-1 group-hover:text-white" />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {showcase.map((item) => (
                  <div
                    key={item.title}
                    className={`h-28 rounded-2xl bg-gradient-to-br ${item.className}`}
                  />
                ))}
              </div>
            </Link>

            <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-6">
              <h2 className="text-xl font-semibold">特色功能</h2>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {featureItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.label}
                      href="/workspace"
                      className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 text-sm text-white/76 transition hover:bg-white/[0.1] hover:text-white"
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/12">
                        <Icon className="h-4 w-4" />
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">为你推荐</h2>
              <p className="mt-1 text-sm text-white/42">常用图片生成场景，可以直接进入画布继续编辑。</p>
            </div>
            <Link href="/templates" className="text-sm text-white/52 hover:text-white">
              查看全部
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {showcase.map((item) => (
              <Link
                key={item.title}
                href="/workspace"
                className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] transition hover:bg-white/[0.075]"
              >
                <div className={`h-44 bg-gradient-to-br ${item.className}`} />
                <div className="p-5">
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/45">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
