"use client";

import { useMemo, useState } from "react";
import { BedDouble, MoreHorizontal } from "lucide-react";
import type { BedRow } from "@medcore/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSetBedStatus } from "@/lib/hms";
import { cn } from "@/lib/utils";

const STATUS: Record<BedRow["status"], { label: string; cls: string; dot: string }> = {
  OCCUPIED: { label: "Occupied", cls: "border-primary/30 bg-info-soft", dot: "bg-primary" },
  AVAILABLE: { label: "Available", cls: "border-success/30 bg-success-soft", dot: "bg-success" },
  CLEANING: { label: "Cleaning", cls: "border-warning/30 bg-warning-soft", dot: "bg-warning" },
  RESERVED: { label: "Reserved", cls: "border-border bg-muted", dot: "bg-muted-foreground" },
};

/** Valid next states a nurse/admin can set from each bed state. */
const NEXT: Record<BedRow["status"], BedRow["status"][]> = {
  OCCUPIED: ["CLEANING"],
  CLEANING: ["AVAILABLE"],
  AVAILABLE: ["RESERVED", "CLEANING"],
  RESERVED: ["AVAILABLE"],
};

export function BedBoard({ beds, editable = true }: { beds: BedRow[]; editable?: boolean }) {
  const wards = useMemo(() => [...new Set(beds.map((b) => b.ward))], [beds]);
  const [ward, setWard] = useState("all");
  const setStatus = useSetBedStatus();
  const shown = ward === "all" ? beds : beds.filter((b) => b.ward === ward);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Bed board</CardTitle>
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Legend">
          {Object.entries(STATUS).map(([k, s]) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", s.dot)} aria-hidden /> {s.label} ({beds.filter((b) => b.status === k).length})
            </li>
          ))}
        </ul>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="overflow-x-auto pb-1">
          <Tabs value={ward} onValueChange={setWard}>
            <TabsList>
              <TabsTrigger value="all">All wards</TabsTrigger>
              {wards.map((w) => (
                <TabsTrigger key={w} value={w}>
                  {w}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {shown.map((b) => {
            const s = STATUS[b.status];
            return (
              <li key={b.id} className={cn("relative rounded-xl border p-3", s.cls)}>
                <div className="flex items-start justify-between gap-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <BedDouble className="size-4" aria-hidden /> {b.label}
                  </span>
                  {editable && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" className="-mt-1 -mr-1 size-7" aria-label={`Change status of bed ${b.label}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {NEXT[b.status].map((n) => (
                          <DropdownMenuItem key={n} onSelect={() => setStatus.mutate({ id: b.id, status: n })}>
                            Mark {STATUS[n].label.toLowerCase()}
                            {b.status === "OCCUPIED" && n === "CLEANING" ? " (discharge)" : ""}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{b.patientName ?? s.label}</p>
                <p className="text-[10px] text-muted-foreground uppercase">
                  {b.ward} · {b.type.toLowerCase()}
                </p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
