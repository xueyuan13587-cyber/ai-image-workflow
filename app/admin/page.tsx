import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminRechargePanel } from "@/modules/admin/components/admin-recharge-panel";
import { AdminPlatformPanel } from "@/modules/admin/components/admin-platform-panel";
import { SESSION_COOKIE, verifySessionToken } from "@/modules/auth/server/auth";
import { getAdminOverview, isAdminUser } from "@/modules/admin/server/admin-service";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    redirect("/login");
  }

  if (!isAdminUser(session.username)) {
    redirect("/");
  }

  const overview = await getAdminOverview();

  return (
    <main className="min-h-screen bg-[#101112] px-6 py-8 text-white">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">平台后台</h1>
            <p className="mt-1 text-sm text-white/45">
              模型、渠道、积分、任务日志和运营配置的管理入口。
            </p>
          </div>
          <Link className="tapnow-pill" href="/">
            返回创作台
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["总任务", overview.stats.totalTasks],
            ["等待中", overview.stats.pending],
            ["生成中", overview.stats.processing],
            ["成功", overview.stats.success],
            ["失败", overview.stats.failed]
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-white/[0.05] p-4"
            >
              <div className="text-sm text-white/45">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
            <h2 className="text-lg font-semibold">模型管理</h2>
            <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
              {overview.models.map((model) => (
                <div
                  key={model.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/10 px-3 py-3 text-sm last:border-b-0"
                >
                  <div>
                    <div className="font-semibold">{model.name}</div>
                    <div className="text-xs text-white/38">{model.id}</div>
                  </div>
                  <div>{model.baseCredits} 积分</div>
                  <div className={model.enabled ? "text-emerald-300" : "text-red-300"}>
                    {model.enabled ? "启用" : "停用"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
            <h2 className="text-lg font-semibold">渠道管理</h2>
            <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
              {overview.channels.map((channel) => (
                <div
                  key={channel.id}
                  className="grid gap-1 border-b border-white/10 px-3 py-3 text-sm last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{channel.name}</span>
                    <span className={channel.enabled ? "text-emerald-300" : "text-red-300"}>
                      {channel.enabled ? "启用" : "停用"}
                    </span>
                  </div>
                  <div className="break-all text-xs text-white/38">{channel.baseUrl}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <AdminPlatformPanel
          initial={{
            models: overview.models,
            channels: overview.channels,
            pricingRules: overview.pricingRules,
            sensitiveWords: overview.sensitiveWords,
            templates: overview.templates
          }}
        />

        <AdminRechargePanel
          initialPlans={overview.rechargePlans}
          initialOrders={overview.rechargeOrders}
        />

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
            <h2 className="text-lg font-semibold">任务日志</h2>
            <div className="mt-4 grid gap-2">
              {overview.tasks.length === 0 ? (
                <div className="text-sm text-white/42">暂无任务。</div>
              ) : (
                overview.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{task.model}</span>
                      <span className="rounded-full bg-white/[0.08] px-2 py-1 text-xs">
                        {task.status}
                      </span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-white/45">{task.prompt}</div>
                    <div className="mt-2 text-xs text-white/35">
                      {task.userId} · {task.costCredits} 积分 · {task.createdAt}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
            <h2 className="text-lg font-semibold">运营模块</h2>
            <div className="mt-4 grid gap-2 text-sm text-white/55">
              {[
                "用户管理",
                "订单管理",
                "敏感词管理",
                "模板管理",
                "积分计费规则",
                "任务失败退积分"
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                >
                  {item}
                </div>
              ))}
            </div>
            <h3 className="mt-6 text-sm font-semibold text-white/80">最近日志</h3>
            <div className="mt-3 grid gap-2">
              {overview.logs.slice(0, 8).map((log) => (
                <div key={log.id} className="text-xs leading-5 text-white/42">
                  {log.createdAt} · {log.message}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
