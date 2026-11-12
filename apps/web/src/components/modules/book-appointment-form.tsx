"use client";

import { useMemo, useState } from "react";
import { CalendarX2, CheckCircle2, Siren } from "lucide-react";
import { generateSlots, type AppointmentRow, type PatientRow } from "@medcore/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/dashboard/states";
import {
  useBookAppointment,
  useDepartments,
  useDoctorAvailability,
  useDoctorBookings,
  useDoctors,
} from "@/lib/hms";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function nextDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/**
 * Slot-based booking. The slot grid prevents choosing taken times, and the API
 * re-checks for conflicts inside a transaction, so two people can't book the same slot.
 */
export function BookAppointmentForm({
  patients,
  fixedPatientId,
  defaultPatientId,
  allowEmergency = false,
  onBooked,
}: {
  /** Staff choose a patient; patients book for themselves (fixedPatientId). */
  patients?: PatientRow[];
  fixedPatientId?: string;
  defaultPatientId?: string;
  allowEmergency?: boolean;
  onBooked?: (a: AppointmentRow) => void;
}) {
  const departments = useDepartments();
  const doctors = useDoctors();
  const [patientId, setPatientId] = useState(fixedPatientId ?? defaultPatientId ?? "");
  const [departmentId, setDepartmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [reason, setReason] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [booked, setBooked] = useState<AppointmentRow | null>(null);

  const availability = useDoctorAvailability(doctorId || undefined);
  const bookings = useDoctorBookings(doctorId || undefined);
  const book = useBookAppointment();

  const days = useMemo(() => nextDays(14), []);
  const doctorOptions = (doctors.data ?? []).filter((d) => !departmentId || d.departmentId === departmentId);
  const doctor = doctors.data?.find((d) => d.id === doctorId);
  const date = days[day];

  const slots = useMemo(() => {
    if (!availability.data || !bookings.data || !date) return [];
    if (!availability.data.weekdays.includes(date.getDay())) return [];
    return generateSlots(date, availability.data.windows, availability.data.slotMinutes, bookings.data, doctorId);
  }, [availability.data, bookings.data, date, doctorId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!patientId) errs.patient = "Choose a patient";
    if (!doctorId) errs.doctor = "Choose a doctor";
    if (!slot) errs.slot = "Choose an available time";
    if (reason.trim().length < 3) errs.reason = "Briefly describe the reason for the visit";
    setErrors(errs);
    if (Object.keys(errs).length || !slot) return;
    book.mutate(
      { patientId, doctorId, startsAt: slot.startsAt, endsAt: slot.endsAt, reason: reason.trim(), emergency },
      {
        onSuccess: (a) => {
          setBooked(a);
          onBooked?.(a);
        },
        // The slot list refreshes automatically; clear the stale choice.
        onError: () => setSlot(null),
      },
    );
  }

  if (booked) {
    return (
      <Card className="items-center p-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <div>
          <h2 className="text-xl font-semibold">Appointment booked</h2>
          <p className="mt-1 text-muted-foreground">
            {booked.patientName} with {booked.doctorName} on {formatDate(booked.startsAt)} at {formatTime(booked.startsAt)}.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Status: {booked.status === "PENDING" ? "pending confirmation by the front desk" : "confirmed"}.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setBooked(null);
            setSlot(null);
            setReason("");
            setEmergency(false);
          }}
        >
          Book another
        </Button>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Patient & doctor</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {!fixedPatientId && (
              <FormField id="ba-patient" label="Patient" required error={errors.patient} className="sm:col-span-2">
                {(a) => (
                  <NativeSelect {...a} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                    <option value="">Select a patient…</option>
                    {(patients ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.mrn} · {p.phone}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            )}
            <FormField id="ba-dept" label="Department">
              {(a) => (
                <NativeSelect
                  {...a}
                  value={departmentId}
                  onChange={(e) => {
                    setDepartmentId(e.target.value);
                    setDoctorId("");
                    setSlot(null);
                  }}
                >
                  <option value="">All departments</option>
                  {(departments.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="ba-doctor" label="Doctor" required error={errors.doctor}>
              {(a) => (
                <NativeSelect
                  {...a}
                  value={doctorId}
                  onChange={(e) => {
                    setDoctorId(e.target.value);
                    setSlot(null);
                  }}
                >
                  <option value="">Select a doctor…</option>
                  {doctorOptions.map((d) => (
                    <option key={d.id} value={d.id} disabled={!d.available}>
                      {d.name} · {d.department}
                      {!d.available ? " (on leave)" : ""}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Date & time</CardTitle>
            <CardDescription>Greyed-out times are already booked or have passed.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Date">
              {days.map((d, i) => (
                <button
                  key={d.toISOString()}
                  type="button"
                  role="radio"
                  aria-checked={day === i}
                  onClick={() => {
                    setDay(i);
                    setSlot(null);
                  }}
                  className={cn(
                    "flex w-16 shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-xs transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    day === i ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                  )}
                >
                  <span className={day === i ? "opacity-90" : "text-muted-foreground"}>{d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                  <span className="font-display text-lg font-semibold">{d.getDate()}</span>
                  <span className={day === i ? "opacity-90" : "text-muted-foreground"}>{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                </button>
              ))}
            </div>

            {!doctorId ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Choose a doctor to see available times.</p>
            ) : availability.isLoading || bookings.isLoading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-9" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <EmptyState icon={CalendarX2} title="No sessions on this day" description="Try another date." className="py-6" />
            ) : (
              <div role="radiogroup" aria-label="Time slot" className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                {slots.map((s) => {
                  const selected = slot?.startsAt === s.startsAt;
                  return (
                    <button
                      key={s.startsAt}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!s.available}
                      onClick={() => setSlot({ startsAt: s.startsAt, endsAt: s.endsAt })}
                      className={cn(
                        "h-9 rounded-lg border text-xs font-medium tabular-nums transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                        selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50 hover:bg-accent",
                        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground/60 disabled:line-through",
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}
            {errors.slot && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {errors.slot}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Reason for visit</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField id="ba-reason" label="Reason" required error={errors.reason}>
              {(a) => <Textarea {...a} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Follow-up for blood pressure" />}
            </FormField>
            {allowEmergency && (
              <label className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive-soft/50 p-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--destructive)]" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} />
                <span>
                  <span className="flex items-center gap-1.5 font-medium text-destructive">
                    <Siren className="size-4" aria-hidden /> Emergency
                  </span>
                  <span className="text-muted-foreground">Confirms immediately and alerts the doctor in real time.</span>
                </span>
              </label>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Patient" value={fixedPatientId ? "You" : (patients?.find((p) => p.id === patientId)?.name ?? "—")} />
          <Row label="Doctor" value={doctor?.name ?? "—"} />
          <Row label="Department" value={doctor?.department ?? "—"} />
          <Row label="Date" value={date ? formatDate(date) : "—"} />
          <Row label="Time" value={slot ? formatTime(slot.startsAt) : "—"} />
          <Row label="Consultation fee" value={doctor ? formatCurrency(doctor.consultationFee) : "—"} />
          <Button type="submit" size="lg" className="mt-2" loading={book.isPending}>
            Book appointment
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
