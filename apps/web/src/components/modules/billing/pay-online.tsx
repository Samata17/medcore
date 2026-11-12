"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import type { InvoiceRow } from "@medcore/types";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

/** Whether the API has online payments configured (live mode only). */
export function usePaymentConfig() {
  const mode = useAuthStore((s) => s.mode);
  return useQuery({
    queryKey: [mode, "billing-config"],
    queryFn: () => authFetch<{ online: boolean; provider: string | null; keyId: string | null }>("/billing/config"),
    enabled: mode === "live",
    staleTime: 5 * 60_000,
  });
}

function loadCheckout() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load the payment window. Check your connection."));
    document.body.appendChild(s);
  });
}

/**
 * Razorpay test-mode checkout. The invoice is only marked paid after the API
 * verifies Razorpay's signature — the browser's "success" alone changes nothing.
 */
export function PayOnlineButton({ invoice }: { invoice: InvoiceRow }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    try {
      const order = await authFetch<{ keyId: string; orderId: string; amount: number; currency: string; invoiceNumber: string }>(
        `/billing/invoices/${invoice.id}/online-order`,
        { method: "POST" },
      );
      await loadCheckout();
      const rzp = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: user?.hospitalName ?? "MedCore HMS",
        description: `Invoice ${order.invoiceNumber}`,
        prefill: { name: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(), email: user?.email },
        theme: { color: "#0b4f9c" },
        handler: async (r: RazorpayResponse) => {
          try {
            await authFetch("/billing/payments/razorpay/verify", {
              method: "POST",
              body: JSON.stringify({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
            });
            toast.success("Payment verified. Thank you!");
          } catch (e) {
            toast.error(`Payment couldn't be verified: ${(e as Error).message}. If money was deducted, it will be reconciled automatically.`);
          } finally {
            queryClient.invalidateQueries({ predicate: (q) => q.queryKey[1] === "invoices" });
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", () => toast.error("Payment failed or was cancelled. You have not been charged."));
      rzp.open();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Button size="sm" loading={busy} onClick={pay}>
      {!busy && <CreditCard />} Pay online
    </Button>
  );
}
