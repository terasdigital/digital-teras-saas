"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOrderStatusAction } from "@/lib/actions/order";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  type OrderStatus,
} from "@/lib/order-status";

export function OrderStatusSelect({
  orderId,
  current,
}: {
  orderId: string;
  current: OrderStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function change(nextValue: string) {
    start(async () => {
      const res = await updateOrderStatusAction(orderId, nextValue);
      if (res?.error) toast.error(res.error);
      else toast.success(`Status → ${ORDER_STATUS_LABEL[nextValue as OrderStatus]}`);
      router.refresh();
    });
  }

  return (
    <select
      value={current}
      disabled={pending}
      onChange={(e) => change(e.target.value)}
      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs font-medium disabled:opacity-50"
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {ORDER_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
