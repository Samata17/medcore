"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import type { NotificationType } from "@medcore/types";
import { API_URL } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

/** Which cached lists to refresh when a notification of each type arrives. */
const REFRESH: Partial<Record<NotificationType, string[]>> = {
  APPOINTMENT_CONFIRMED: ["appointments", "record"],
  APPOINTMENT_REMINDER: ["appointments"],
  EMERGENCY_APPOINTMENT: ["appointments"],
  LAB_REPORT_APPROVED: ["labOrders", "record"],
  PRESCRIPTION_READY: ["prescriptions", "record"],
  INVOICE_ISSUED: ["invoices"],
  PAYMENT_RECEIVED: ["invoices"],
  LOW_STOCK: ["batches"],
  SYSTEM: ["labOrders", "appointments"],
};

/**
 * Live notifications over Socket.IO (live mode only).
 * The socket authenticates with the in-memory access token; on reconnect it
 * reads the latest token, so silent token refreshes keep working.
 */
export function useRealtimeNotifications() {
  const mode = useAuthStore((s) => s.mode);
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (mode !== "live" || !userId) return;
    const origin = new URL(API_URL).origin;
    const socket: Socket = io(`${origin}/notifications`, {
      transports: ["websocket"],
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
      reconnectionDelayMax: 10_000,
    });

    socket.on("notification", (n: { type: NotificationType; title: string; body: string }) => {
      const refresh = new Set(["notifications", ...(REFRESH[n.type] ?? [])]);
      queryClient.invalidateQueries({ predicate: (q) => refresh.has(String(q.queryKey[1])) });
      const show = n.type === "EMERGENCY_APPOINTMENT" || n.type === "LOW_STOCK" ? toast.warning : toast.info;
      show(n.title, { description: n.body });
    });

    return () => {
      socket.close();
    };
  }, [mode, userId, queryClient]);
}
