"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { ROLE_LABELS, type Role, type StaffRow } from "@medcore/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DataTable } from "@/components/dashboard/data-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { useCreateStaff, useDepartments, useSetStaffActive, useStaff } from "@/lib/hms";
import { formatDate } from "@/lib/format";

/** Hospital admins can create these roles (never Super Admin or Patient). */
const STAFF_ROLES: Role[] = ["HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "LAB_TECHNICIAN", "PHARMACIST", "ACCOUNTANT"];

function AddStaffDialog() {
  const create = useCreateStaff();
  const departments = useDepartments();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", email: "", role: "DOCTOR" as Role, department: "" });
  const [error, setError] = useState("");

  function submit() {
    if (f.name.trim().length < 3) return setError("Enter the full name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return setError("Enter a valid email");
    setError("");
    create.mutate(
      { name: f.role === "DOCTOR" && !f.name.startsWith("Dr.") ? `Dr. ${f.name.trim()}` : f.name.trim(), email: f.email.trim(), role: f.role, department: f.department || undefined },
      {
        onSuccess: () => {
          setOpen(false);
          setF({ name: "", email: "", role: "DOCTOR", department: "" });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Add staff
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a staff member</DialogTitle>
          <DialogDescription>They receive an email to set their own password. Passwords are never set or seen by admins.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField id="s-name" label="Full name" required>
            {(a) => <Input {...a} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
          </FormField>
          <FormField id="s-email" label="Work email" required>
            {(a) => <Input {...a} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="s-role" label="Role" required>
              {(a) => (
                <NativeSelect {...a} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="s-dept" label="Department">
              {(a) => (
                <NativeSelect {...a} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>
                  <option value="">—</option>
                  {(departments.data ?? []).map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </div>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Add staff member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function StaffPage() {
  const staff = useStaff();
  const setActive = useSetStaffActive();
  const [target, setTarget] = useState<StaffRow | null>(null);

  return (
    <>
      <PageHeader title="Staff" description="Accounts for everyone working at this hospital." sample={staff.isSample} actions={<AddStaffDialog />} />
      <DataTable
        data={staff.data}
        isLoading={staff.isLoading}
        isError={staff.isError}
        onRetry={() => staff.refetch()}
        getRowId={(s) => s.id}
        caption="Staff"
        searchText={(s) => `${s.name} ${s.email} ${s.department ?? ""}`}
        searchPlaceholder="Search name, email or department"
        filters={[
          { id: "role", label: "Roles", options: STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })), match: (s, v) => s.role === v },
          { id: "active", label: "States", options: [{ value: "1", label: "Active" }, { value: "0", label: "Deactivated" }], match: (s, v) => s.active === (v === "1") },
        ]}
        columns={[
          { id: "name", header: "Name", sortValue: (s) => s.name, cell: (s) => <div className="flex items-center gap-3"><Avatar name={s.name} className="size-8" /><div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.email}</p></div></div> },
          { id: "role", header: "Role", sortValue: (s) => s.role, cell: (s) => ROLE_LABELS[s.role] },
          { id: "dept", header: "Department", hideBelow: "md", cell: (s) => s.department ?? "—" },
          { id: "joined", header: "Joined", hideBelow: "lg", sortValue: (s) => s.joinedAt, cell: (s) => formatDate(s.joinedAt) },
          { id: "status", header: "Status", cell: (s) => (s.active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Deactivated</Badge>) },
          {
            id: "actions",
            header: "",
            className: "text-right",
            cell: (s) =>
              s.active ? (
                <Button size="sm" variant="outline" onClick={() => setTarget(s)}>
                  Deactivate
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setActive.mutate({ id: s.id, active: true })}>
                  Reactivate
                </Button>
              ),
          },
        ]}
      />
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Deactivate ${target?.name}?`}
        description="They will be signed out and can't log in until reactivated. Their past records and audit history are kept."
        confirmLabel="Deactivate"
        onConfirm={() => target && setActive.mutateAsync({ id: target.id, active: false })}
      />
    </>
  );
}
