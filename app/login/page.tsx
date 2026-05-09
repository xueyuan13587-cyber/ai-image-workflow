import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (session) {
    redirect("/");
  }

  return (
    <main className="tapnow-shell flex min-h-screen items-center justify-center px-6 text-white">
      <section className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl backdrop-blur-xl">
        <div className="mb-7">
          <div className="tapnow-logo mb-5">
            <span />
            <span />
            <span />
          </div>
          <h1 className="text-2xl font-semibold">登录 AI 图片工作流</h1>
          <p className="mt-2 text-sm leading-6 text-white/50">
            登录后才能使用画布和图片生成接口。
          </p>
        </div>
        <LoginForm />
        {process.env.NODE_ENV !== "production" && (
          <p className="mt-5 rounded-lg bg-white/[0.05] px-3 py-2 text-xs leading-5 text-white/42">
            本地开发默认账号：admin，密码：admin123。正式部署请配置 AUTH_USERS 和
            AUTH_SECRET。
          </p>
        )}
      </section>
    </main>
  );
}
