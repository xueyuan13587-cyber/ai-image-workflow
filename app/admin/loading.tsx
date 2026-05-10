export default function AdminLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#101112] px-6 text-white">
      <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-5 shadow-2xl">
        <div className="text-sm font-semibold">后台加载中...</div>
        <div className="mt-2 text-xs text-white/45">正在读取模型、订单和任务数据。</div>
      </div>
    </main>
  );
}
