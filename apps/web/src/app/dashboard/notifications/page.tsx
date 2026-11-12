"use client";

import { useState } from "react";
import { BellOff, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState, ErrorState } from "@/components/dashboard/states";
import { NotificationRow } from "@/components/dashboard/notification-center";
import { useNotifications } from "@/hooks/use-notifications";

export default function NotificationsPage() {
  const { data, isLoading, isError, refetch, unread, markRead, isSample } = useNotifications();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const list = tab === "unread" ? data?.filter((n) => !n.read) : data;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Appointment, lab, prescription, billing and stock alerts for your role."
        sample={isSample}
        actions={
          <Button variant="outline" disabled={!unread} onClick={() => markRead.mutate(undefined)}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unread})</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card className="gap-0 overflow-hidden py-0">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !list?.length ? (
          <EmptyState icon={BellOff} title={tab === "unread" ? "No unread notifications" : "No notifications yet"} />
        ) : (
          <ul className="divide-y">
            {list.map((n) => (
              <NotificationRow key={n.id} n={n} onRead={(id) => markRead.mutate(id)} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
