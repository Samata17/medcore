"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/dashboard/data-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorState } from "@/components/dashboard/states";
import { BedBoard } from "@/components/modules/bed-board";
import { useBeds, useDepartments } from "@/lib/hms";

export default function DepartmentsPage() {
  const departments = useDepartments();
  const beds = useBeds();
  return (
    <>
      <PageHeader title="Departments & beds" description="Department heads, doctor counts and bed availability." sample={departments.isSample} />
      <div className="grid gap-6">
        <DataTable
          data={departments.data}
          isLoading={departments.isLoading}
          isError={departments.isError}
          onRetry={() => departments.refetch()}
          getRowId={(d) => d.id}
          caption="Departments"
          columns={[
            { id: "name", header: "Department", sortValue: (d) => d.name, cell: (d) => <span className="font-medium">{d.name}</span> },
            { id: "head", header: "Head", hideBelow: "sm", cell: (d) => d.headDoctor ?? "—" },
            { id: "doctors", header: "Doctors", className: "text-right", sortValue: (d) => d.doctors, cell: (d) => <span className="tabular-nums">{d.doctors}</span> },
            { id: "today", header: "Patients today", className: "text-right", sortValue: (d) => d.patientsToday, cell: (d) => <span className="tabular-nums">{d.patientsToday}</span> },
          ]}
        />
        {beds.isLoading ? <Skeleton className="h-80" /> : beds.isError ? <ErrorState onRetry={() => beds.refetch()} /> : <BedBoard beds={beds.data ?? []} />}
      </div>
    </>
  );
}
