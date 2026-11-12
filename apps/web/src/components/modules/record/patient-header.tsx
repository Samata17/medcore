import { AlertTriangle, Droplet, Phone } from "lucide-react";
import type { PatientRow } from "@medcore/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ageFrom, formatDate } from "@/lib/format";

const SEX = { MALE: "Male", FEMALE: "Female", OTHER: "Other" } as const;

/** Patient profile card shown at the top of every clinical screen. */
export function PatientHeader({ patient, actions }: { patient: PatientRow; actions?: React.ReactNode }) {
  return (
    <Card className="gap-4 p-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Avatar name={patient.name} className="size-14 text-base" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{patient.name}</h1>
          <p className="text-sm text-muted-foreground">
            {patient.mrn} · {ageFrom(patient.dateOfBirth)} y · {SEX[patient.gender]} · DOB {formatDate(patient.dateOfBirth)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="neutral">
              <Droplet /> {patient.bloodGroup ?? "Blood group unknown"}
            </Badge>
            <Badge variant="neutral">
              <Phone /> {patient.phone}
            </Badge>
            {patient.allergies.length ? (
              <Badge variant="danger">
                <AlertTriangle /> Allergies: {patient.allergies.join(", ")}
              </Badge>
            ) : (
              <Badge variant="success">No known allergies</Badge>
            )}
          </div>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </Card>
  );
}
