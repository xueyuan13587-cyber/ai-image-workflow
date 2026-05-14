"use client";

import { useState } from "react";

type RechargePlan = {
  id: string;
  name: string;
  credits: number;
  bonusCredits?: number;
  priceCny: number;
  enabled: boolean;
  description?: string;
};

type RechargeOrder = {
  id: string;
  userId: string;
  planName: string;
  totalCredits: number;
  priceCny: number;
  status: "pending" | "paid" | "rejected";
  paymentNote?: string;
  adminNote?: string;
  createdAt: string;
};

type Props = {
  initialPlans: RechargePlan[];
  initialOrders: RechargeOrder[];
};

function toPositiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function AdminRechargePanel({ initialPlans, initialOrders }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [orders, setOrders] = useState(initialOrders);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function updatePlan(index: number, next: Partial<RechargePlan>) {
    setPlans((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item))
    );
  }

  async function savePlans() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rechargePlans: plans })
      });
      const payload = (await response.json()) as {
        error?: string;
        rechargePlans?: RechargePlan[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "保存充值套餐失败。");
      }

      setPlans(payload.rechargePlans ?? plans);
      setMessage("充值套餐已保存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存充值套餐失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleOrder(orderId: string, action: "approve" | "reject") {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/recharge/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action })
      });
      const payload = (await response.json()) as {
        error?: string;
        rechargeOrders?: RechargeOrder[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "处理充值订单失败。");
      }

      setOrders(payload.rechargeOrders ?? orders);
      setMessage(action === "approve" ? "订单已通过，积分已到账。" : "订单已拒绝。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "处理充值订单失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">充值套餐</h2>
            <p className="mt-1 text-sm text-white/42">用户端会展示已启用的套餐。</p>
          </div>
          <button className="tapnow-run" type="button" onClick={savePlans} disabled={saving}>
            保存
          </button>
        </div>

        {message && <div className="mt-3 text-sm text-cyan-200">{message}</div>}

        <div className="mt-4 grid gap-3">
          {plans.map((plan, index) => (
            <div key={plan.id} className="rounded-lg border border-white/10 bg-black/15 p-3">
              <div className="flex items-center justify-between gap-3">
                <input
                  className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none"
                  value={plan.name}
                  onChange={(event) => updatePlan(index, { name: event.currentTarget.value })}
                />
                <label className="flex items-center gap-2 text-xs text-white/55">
                  <input
                    type="checkbox"
                    checked={plan.enabled}
                    onChange={(event) =>
                      updatePlan(index, { enabled: event.currentTarget.checked })
                    }
                  />
                  启用
                </label>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <label className="grid gap-1 text-xs text-white/45">
                  价格 CNY
                  <input
                    className="h-9 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none"
                    type="number"
                    value={plan.priceCny}
                    onChange={(event) =>
                      updatePlan(index, {
                        priceCny: toPositiveNumber(event.currentTarget.value, plan.priceCny)
                      })
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs text-white/45">
                  积分
                  <input
                    className="h-9 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none"
                    type="number"
                    value={plan.credits}
                    onChange={(event) =>
                      updatePlan(index, {
                        credits: Math.round(
                          toPositiveNumber(event.currentTarget.value, plan.credits)
                        )
                      })
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs text-white/45">
                  赠送
                  <input
                    className="h-9 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none"
                    type="number"
                    value={plan.bonusCredits ?? 0}
                    onChange={(event) =>
                      updatePlan(index, {
                        bonusCredits: Math.round(
                          toPositiveNumber(event.currentTarget.value, plan.bonusCredits ?? 0)
                        )
                      })
                    }
                  />
                </label>
              </div>

              <input
                className="mt-3 h-9 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none"
                value={plan.description ?? ""}
                placeholder="套餐说明"
                onChange={(event) =>
                  updatePlan(index, { description: event.currentTarget.value })
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
        <h2 className="text-lg font-semibold">充值订单</h2>
        <div className="mt-4 grid max-h-[620px] gap-3 overflow-auto pr-1">
          {orders.length === 0 ? (
            <div className="text-sm text-white/42">暂无充值订单。</div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{order.userId}</div>
                    <div className="text-xs text-white/38">{order.id}</div>
                  </div>
                  <span className="rounded-full bg-white/[0.08] px-2 py-1 text-xs">
                    {order.status}
                  </span>
                </div>
                <div className="mt-2 text-sm text-white/70">
                  {order.planName} · ¥{order.priceCny} · {order.totalCredits} 积分
                </div>
                {order.paymentNote && (
                  <div className="mt-2 text-xs text-white/42">{order.paymentNote}</div>
                )}
                <div className="mt-2 text-xs text-white/35">{order.createdAt}</div>
                {order.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      className="tapnow-run !min-h-9 !px-4"
                      type="button"
                      disabled={saving}
                      onClick={() => handleOrder(order.id, "approve")}
                    >
                      通过并加积分
                    </button>
                    <button
                      className="tapnow-pill !min-h-9 !px-4"
                      type="button"
                      disabled={saving}
                      onClick={() => handleOrder(order.id, "reject")}
                    >
                      拒绝
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
