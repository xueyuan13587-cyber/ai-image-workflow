"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Gem, Home, LayoutTemplate, LogOut, BriefcaseBusiness } from "lucide-react";

const navItems = [
  { href: "/", label: "主页", icon: Home },
  { href: "/templates", label: "模板库", icon: LayoutTemplate },
  { href: "/workspace", label: "工作空间", icon: BriefcaseBusiness }
];

export function AppTopNav({ username }: { username: string }) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#111214]/92 px-5 py-3 text-white backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 transition hover:bg-white/[0.1]"
            title="返回主页"
          >
            <div className="tapnow-logo !h-6 !w-6 scale-75">
              <span />
              <span />
              <span />
            </div>
            <span className="text-sm font-semibold">AI 聚合创作台</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                    active
                      ? "bg-white/[0.1] text-white"
                      : "text-white/52 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/workspace"
            className="hidden rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/18 sm:inline-flex"
          >
            新建项目
          </Link>
          <div className="hidden items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 text-sm text-white/72 sm:flex">
            <Gem className="h-4 w-4 text-emerald-200" />
            <span className="max-w-[120px] truncate">{username}</span>
            <ChevronDown className="h-4 w-4 text-white/38" />
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-white/62 transition hover:bg-white/[0.1] hover:text-white"
            title="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
