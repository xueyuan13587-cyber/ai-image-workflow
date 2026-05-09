"use client";

import { Lock, LogIn, User, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "register" && password !== confirmPassword) {
      setLoading(false);
      setError("两次输入的密码不一致。");
      return;
    }

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? (mode === "login" ? "登录失败" : "注册失败"));
      }

      router.replace("/");
      router.refresh();
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : mode === "login"
            ? "登录失败"
            : "注册失败"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.04] p-1">
        <button
          className="h-10 rounded-lg text-sm font-semibold text-white/55 transition data-[active=true]:bg-white/[0.12] data-[active=true]:text-white"
          type="button"
          data-active={mode === "login"}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          登录
        </button>
        <button
          className="h-10 rounded-lg text-sm font-semibold text-white/55 transition data-[active=true]:bg-white/[0.12] data-[active=true]:text-white"
          type="button"
          data-active={mode === "register"}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          注册
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4">
        <label className="grid gap-2 text-sm text-white/68">
          账号
          <div className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4">
            <User className="h-4 w-4 text-white/45" />
            <input
              value={username}
              onChange={(event) => setUsername(event.currentTarget.value)}
              className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/28"
              placeholder="3-24 位英文、数字或下划线"
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
              placeholder="至少 6 位"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </div>
        </label>

        {mode === "register" && (
          <label className="grid gap-2 text-sm text-white/68">
            确认密码
            <div className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4">
              <Lock className="h-4 w-4 text-white/45" />
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/28"
                placeholder="再输入一次密码"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
          </label>
        )}

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
          {mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {loading
            ? mode === "login"
              ? "登录中"
              : "注册中"
            : mode === "login"
              ? "登录"
              : "注册并进入"}
        </button>
      </form>
    </div>
  );
}
