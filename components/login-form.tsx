"use client";

import { Lock, LogIn, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "登录失败");
      }

      router.replace("/");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-2 text-sm text-white/68">
        账号
        <div className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4">
          <User className="h-4 w-4 text-white/45" />
          <input
            value={username}
            onChange={(event) => setUsername(event.currentTarget.value)}
            className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/28"
            placeholder="输入账号"
            autoComplete="username"
            required
          />
        </div>
      </label>

      <label className="grid gap-2 text-sm text-white/68">
        密码
        <div className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4">
          <Lock className="h-4 w-4 text-white/45" />
          <input
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/28"
            placeholder="输入密码"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
      </label>

      {error && (
        <div className="rounded-lg border border-red-400/25 bg-red-500/12 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      )}

      <button
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-70"
        type="submit"
        disabled={loading}
      >
        <LogIn className="h-4 w-4" />
        {loading ? "登录中" : "登录"}
      </button>
    </form>
  );
}
