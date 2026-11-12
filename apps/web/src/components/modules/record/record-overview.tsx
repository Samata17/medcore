"use client";

import { AlertTriangle, Syringe, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartCard, TrendChart } from "@/components/dashboard/charts";
import { vitalFlags } from "@/components/modules/record/vitals";
import { bmiCategory, formatDate, formatDateTime } from "@/lib/format";
import type { PatientRecord } from "@/lib/hms";

/** Summary used by doctors (encounter) and patients (portal). */
export function RecordOverview({ record, sample }: { record: PatientRecord; sample?: boolean }) {
  const latest = record.vitals[0];
  const bpSeries = record.vitals
    .filter((v) => v.systolic)
    .toReversed()
    .map((v) => ({ date: formatDate(v.recordedAt, { day: "numeric", month: "short" }), Systolic: v.systolic!, Diastolic: v.diastolic! }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="grid h-fit gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Latest vitals</CardTitle>
          </CardHeader>
          <CardContent>
            {!latest ? (
              <p className="text-sm text-muted-foreground">No vitals recorded yet.</p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Blood pressure", latest.systolic ? `${latest.systolic}/${latest.diastolic}` : "—", "mmHg"],
                    ["Pulse", latest.pulse ?? "—", "bpm"],
                    ["Temperature", latest.temperatureC ?? "—", "°C"],
                    ["SpO₂", latest.spo2 ?? "—", "%"],
                    ["Height", latest.heightCm ?? "—", "cm"],
                    ["Weight", latest.weightKg ?? "—", "kg"],
                  ].map(([label, value, unit]) => (
                    <div key={label as string} className="rounded-lg bg-muted/50 p-3">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums">
                        {value} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
                      </dd>
                    </div>
                  ))}
                  <div className="col-span-2 rounded-lg bg-muted/50 p-3">
                    <dt className="text-xs text-muted-foreground">BMI</dt>
                    <dd className="mt-0.5 flex items-center gap-2 font-display text-lg font-semibold tabular-nums">
                      {latest.bmi ?? "—"}
                      {latest.bmi && <Badge variant={bmiCategory(latest.bmi).tone}>{bmiCategory(latest.bmi).label}</Badge>}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  Recorded {formatDateTime(latest.recordedAt)} by {latest.recordedBy}
                  {vitalFlags(latest).length > 0 && <span className="ml-2 font-semibold text-destructive">Attention: {vitalFlags(latest).join(", ")}</span>}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {bpSeries.length > 1 && (
          <ChartCard
            title="Blood pressure trend"
            sample={sample}
            table={{ columns: ["Date", "Systolic", "Diastolic"], rows: bpSeries.map((r) => [r.date, r.Systolic, r.Diastolic]) }}
          >
            <TrendChart
              kind="line"
              data={bpSeries}
              xKey="date"
              height={200}
              series={[
                { key: "Systolic", label: "Systolic", color: 1 },
                { key: "Diastolic", label: "Diastolic", color: 2 },
              ]}
            />
          </ChartCard>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Diagnoses</CardTitle>
          </CardHeader>
          <CardContent>
            {record.diagnoses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No diagnoses recorded.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {record.diagnoses.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3">
                    <span>
                      {d.code && <span className="mr-2 font-mono text-xs text-muted-foreground">{d.code}</span>}
                      {d.description}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(d.recordedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid h-fit gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" aria-hidden /> Allergies & adverse reactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {record.patient.allergies.length ? (
              <div className="flex flex-wrap gap-2">
                {record.patient.allergies.map((a) => (
                  <Badge key={a} variant="danger">
                    {a}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No known allergies.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Syringe className="size-4 text-teal" aria-hidden /> Vaccinations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {record.vaccinations.length ? (
              <ul className="grid gap-2 text-sm">
                {record.vaccinations.map((v) => (
                  <li key={v.name + v.date} className="flex justify-between gap-3">
                    <span>
                      {v.name} <span className="text-muted-foreground">· {v.dose}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(v.date)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No vaccinations on record.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-primary" aria-hidden /> Family history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {record.familyHistory.length ? (
              <ul className="grid list-disc gap-1 pl-5 text-sm">
                {record.familyHistory.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
