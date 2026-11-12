"use client";

import type { HospitalRow } from "@medcore/types";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { DataTable } from "@/components/dashboard/data-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { HospitalStatusBadge, PLAN_LABEL, PLAN_PRICE } from "@/components/modules/hospital-status-badge";
import { useChangePlan, useHospitals } from "@/lib/hms";
import { formatCurrency } from "@/lib/format";

const PLANS: HospitalRow["plan"][] = ["BASIC", "PROFESSIONAL", "ENTERPRISE"];
const FEATURES: Record<HospitalRow["plan"], string> = {
  BASIC: "Up to 50 beds · core modules",
  PROFESSIONAL: "Up to 150 beds · lab, pharmacy & analytics",
  ENTERPRISE: "Unlimited beds · multi-branch & priority support",
};

export default function SubscriptionsPage() {
  const hospitals = useHospitals();
  const change = useChangePlan();
  const h = hospitals.data ?? [];
  const billable = h.filter((x) => x.status === "ACTIVE");

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Plans per hospital. Subscription billing through a payment gateway can be configured later; changes here update the plan record only."
        sample={hospitals.isSample}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const count = billable.filter((x) => x.plan === p).length;
          return (
            <Card key={p} className="gap-2 p-5">
              <p className="text-sm text-muted-foreground">{PLAN_LABEL[p]}</p>
              <p className="font-display text-2xl font-bold">
                {formatCurrency(PLAN_PRICE[p])}
                <span className="text-sm font-normal text-muted-foreground"> / month</span>
              </p>
              <p className="text-xs text-muted-foreground">{FEATURES[p]}</p>
              <p className="mt-2 text-sm">
                <span className="font-semibold">{count}</span> active hospital{count === 1 ? "" : "s"} · {formatCurrency(count * PLAN_PRICE[p])} MRR
              </p>
            </Card>
          );
        })}
      </div>
      <DataTable
        data={hospitals.data}
        isLoading={hospitals.isLoading}
        isError={hospitals.isError}
        onRetry={() => hospitals.refetch()}
        getRowId={(x) => x.id}
        caption="Hospital subscriptions"
        searchText={(x) => x.name}
        searchPlaceholder="Search hospital"
        columns={[
          { id: "name", header: "Hospital", sortValue: (x) => x.name, cell: (x) => <span className="font-medium">{x.name}</span> },
          { id: "status", header: "Status", cell: (x) => <HospitalStatusBadge status={x.status} /> },
          { id: "price", header: "Monthly fee", className: "text-right", sortValue: (x) => PLAN_PRICE[x.plan], cell: (x) => <span className="tabular-nums">{formatCurrency(PLAN_PRICE[x.plan])}</span> },
          {
            id: "plan",
            header: "Plan",
            cell: (x) => (
              <NativeSelect
                aria-label={`Plan for ${x.name}`}
                value={x.plan}
                disabled={change.isPending}
                onChange={(e) => change.mutate({ id: x.id, plan: e.target.value as HospitalRow["plan"] })}
                className="w-40 [&_select]:h-8"
              >
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {PLAN_LABEL[p]}
                  </option>
                ))}
              </NativeSelect>
            ),
          },
        ]}
      />
    </>
  );
}
