"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { useCreateLabOrder } from "@/lib/hms";
import { useLabCatalog } from "@/lib/lab";
import { formatCurrency } from "@/lib/format";

export function LabOrderForm({ patientId }: { patientId: string }) {
  const catalog = useLabCatalog();
  const create = useCreateLabOrder(patientId);
  const [test, setTest] = useState("");
  const [priority, setPriority] = useState<"ROUTINE" | "URGENT">("ROUTINE");
  const [error, setError] = useState("");

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!test) return setError("Choose a test");
        setError("");
        create.mutate({ testName: test, priority }, { onSuccess: () => setTest("") });
      }}
      className="grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-[1fr_10rem_auto] sm:items-start"
    >
      <FormField id="lo-test" label="Test" required error={error}>
        {(a) => (
          <NativeSelect {...a} value={test} onChange={(e) => setTest(e.target.value)}>
            <option value="">Select a test…</option>
            {(catalog.data ?? []).map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} · {formatCurrency(t.price)}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField id="lo-priority" label="Priority">
        {(a) => (
          <NativeSelect {...a} value={priority} onChange={(e) => setPriority(e.target.value as "ROUTINE" | "URGENT")}>
            <option value="ROUTINE">Routine</option>
            <option value="URGENT">Urgent</option>
          </NativeSelect>
        )}
      </FormField>
      <Button type="submit" className="sm:mt-6" loading={create.isPending}>
        <FlaskConical /> Order test
      </Button>
    </form>
  );
}
