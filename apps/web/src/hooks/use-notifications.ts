"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { NotificationItem } from "@medcore/types";
import { authFetch } from "@/lib/api";
import { demoNotifications } from "@/lib/demo/notifications";
import { useHmsQuery } from "@/lib/use-hms-query";
import { useAuthStore } from "@/stores/auth-store";

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  const mode = useAuthStore((s) => s.mode);
  const queryClient = useQueryClient();
  const key = ["notifications", user?.id] as const;

  const query = useHmsQuery<NotificationItem[]>({
    key,
    path: "/notifications",
    demo: () => (user ? demoNotifications(user.role) : []),
  });

  /** Mark one (id) or all (no id) as read. */
  const markRead = useMutation({
    mutationFn: async (id?: string) => {
      if (mode === "live") {
        await authFetch(id ? `/notifications/${id}/read` : "/notifications/read-all", { method: "PATCH" });
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<NotificationItem[]>([mode, ...key], (old) =>
        old?.map((n) => (!id || n.id === id ? { ...n, read: true } : n)),
      );
    },
  });

  const unread = query.data?.filter((n) => !n.read).length ?? 0;
  return { ...query, unread, markRead };
}
