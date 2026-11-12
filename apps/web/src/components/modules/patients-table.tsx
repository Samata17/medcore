"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { PatientRow } from "@medcore/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { ageFrom, formatDate } from "@/lib/format";

const GENDER: Record<PatientRow["gender"], string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

export function PatientsTable({
  data,
  isLoading,
  isError,
  onRetry,
  initialSearch,
  rowAction,
  toolbar,
}: {
  data?: PatientRow[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  initialSearch?: string;
  /** e.g. "Open record" (doctor) or "Book" (reception) */
  rowAction?: (p: PatientRow) => { label: string; href: string };
  toolbar?: React.ReactNode;
}) {
  const columns: Column<PatientRow>[] = [
    {
      id: "name",
      header: "Patient",
      sortValue: (p) => p.name,
      cell: (p) => (
        <div className="flex items-center gap-3">
          <Avatar name={p.name} className="size-8" />
          <div className="min-w-0">
            <p className="truncate font-medium">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.mrn}</p>
          </div>
        </div>
      ),
    },
    {
      id: "age",
      header: "Age / Sex",
      sortValue: (p) => ageFrom(p.dateOfBirth),
      cell: (p) => `${ageFrom(p.dateOfBirth)} y · ${GENDER[p.gender]}`,
    },
    { id: "phone", header: "Phone", hideBelow: "md", cell: (p) => <span className="tabular-nums">{p.phone}</span> },
    { id: "blood", header: "Blood", hideBelow: "lg", cell: (p) => p.bloodGroup ?? <span className="text-muted-foreground">—</span> },
    {
      id: "allergies",
      header: "Allergies",
      hideBelow: "lg",
      cell: (p) =>
        p.allergies.length ? (
          <Badge variant="danger">
            <AlertTriangle /> {p.allergies.join(", ")}
          </Badge>
        ) : (
          <span className="text-muted-foreground">None known</span>
        ),
    },
    {
      id: "lastVisit",
      header: "Last visit",
      hideBelow: "sm",
      sortValue: (p) => p.lastVisit ?? "",
      cell: (p) => (p.lastVisit ? formatDate(p.lastVisit) : <span className="text-muted-foreground">New</span>),
    },
    ...(rowAction
      ? [
          {
            id: "action",
            header: "",
            className: "text-right",
            cell: (p: PatientRow) => {
              const a = rowAction(p);
              return (
                <Button size="sm" variant="outline" asChild>
                  <Link href={a.href}>{a.label}</Link>
                </Button>
              );
            },
          } satisfies Column<PatientRow>,
        ]
      : []),
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      getRowId={(p) => p.id}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      initialSearch={initialSearch}
      searchText={(p) => `${p.name} ${p.mrn} ${p.phone.replace(/\s/g, "")} ${p.phone}`}
      searchPlaceholder="Search name, MRN or phone"
      filters={[
        {
          id: "gender",
          label: "Genders",
          options: [
            { value: "FEMALE", label: "Female" },
            { value: "MALE", label: "Male" },
            { value: "OTHER", label: "Other" },
          ],
          match: (p, v) => p.gender === v,
        },
      ]}
      emptyTitle="No patients yet"
      toolbar={toolbar}
      caption="Patients"
    />
  );
}
