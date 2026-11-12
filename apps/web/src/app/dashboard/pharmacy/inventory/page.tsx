"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { isExpired, stockSummary, type MedicineBatchRow } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/dashboard/data-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExpiryBadge } from "@/components/modules/pharmacy/expiry-badge";
import { useAddBatch, useBatches } from "@/lib/hms";
import { formatCurrency, formatDate } from "@/lib/format";

function AddBatchDialog({ batches }: { batches: MedicineBatchRow[] }) {
  const add = useAddBatch();
  const medicines = useMemo(() => stockSummary(batches), [batches]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ medicineId: "", batchNo: "", manufacturedOn: "", expiresOn: "", quantity: "", unitCost: "", mrp: "" });
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  function submit() {
    const med = medicines.find((m) => m.medicineId === f.medicineId);
    const qty = Number(f.quantity), cost = Number(f.unitCost), mrp = Number(f.mrp);
    if (!med) return setError("Choose a medicine");
    if (!/^[A-Z0-9-]{3,20}$/i.test(f.batchNo)) return setError("Batch number: 3–20 letters, digits or dashes");
    if (!f.manufacturedOn || !f.expiresOn) return setError("Enter manufacturing and expiry dates");
    if (f.manufacturedOn > today) return setError("Manufacturing date can't be in the future");
    if (f.expiresOn <= f.manufacturedOn) return setError("Expiry must be after manufacturing date");
    if (f.expiresOn <= today) return setError("This batch is already expired and can't be added to sellable stock");
    if (!Number.isInteger(qty) || qty < 1) return setError("Quantity must be a whole number above 0");
    if (!(cost > 0) || !(mrp > 0)) return setError("Unit cost and MRP must be above 0");
    if (mrp < cost) return setError("MRP can't be lower than the unit cost");
    setError("");
    const sample = batches.find((x) => x.medicineId === med.medicineId)!;
    add.mutate(
      {
        medicineId: med.medicineId,
        medicineName: med.name,
        category: med.category,
        batchNo: f.batchNo.toUpperCase(),
        manufacturedOn: new Date(f.manufacturedOn).toISOString(),
        expiresOn: new Date(f.expiresOn).toISOString(),
        quantity: qty,
        reorderLevel: sample.reorderLevel,
        unitCost: cost,
        mrp,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setF({ medicineId: "", batchNo: "", manufacturedOn: "", expiresOn: "", quantity: "", unitCost: "", mrp: "" });
        },
      },
    );
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Receive batch
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive a new batch</DialogTitle>
          <DialogDescription>Expired or invalid batches are rejected. Reorder level is inherited from the medicine.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="b-med" label="Medicine" required className="sm:col-span-2">
            {(a) => (
              <NativeSelect {...a} value={f.medicineId} onChange={set("medicineId")}>
                <option value="">Select…</option>
                {medicines.map((m) => (
                  <option key={m.medicineId} value={m.medicineId}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="b-no" label="Batch number" required>
            {(a) => <Input {...a} value={f.batchNo} onChange={set("batchNo")} className="uppercase" />}
          </FormField>
          <FormField id="b-qty" label="Quantity" required>
            {(a) => <Input {...a} type="number" min={1} value={f.quantity} onChange={set("quantity")} />}
          </FormField>
          <FormField id="b-mfg" label="Manufactured on" required>
            {(a) => <Input {...a} type="date" max={today} value={f.manufacturedOn} onChange={set("manufacturedOn")} />}
          </FormField>
          <FormField id="b-exp" label="Expires on" required>
            {(a) => <Input {...a} type="date" min={today} value={f.expiresOn} onChange={set("expiresOn")} />}
          </FormField>
          <FormField id="b-cost" label="Unit cost (₹)" required>
            {(a) => <Input {...a} type="number" step="0.01" min={0} value={f.unitCost} onChange={set("unitCost")} />}
          </FormField>
          <FormField id="b-mrp" label="MRP (₹)" required>
            {(a) => <Input {...a} type="number" step="0.01" min={0} value={f.mrp} onChange={set("mrp")} />}
          </FormField>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={add.isPending}>
            Add batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InventoryPage() {
  const batches = useBatches();
  const b = batches.data ?? [];
  const summary = stockSummary(b);
  const categories = [...new Set(b.map((x) => x.category))];

  return (
    <>
      <PageHeader title="Inventory" description="Batch-level stock with expiry tracking." sample={batches.isSample} actions={<AddBatchDialog batches={b} />} />
      <Tabs defaultValue="batches">
        <TabsList>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="summary">Stock summary</TabsTrigger>
        </TabsList>
        <TabsContent value="batches">
          <DataTable
            data={batches.data}
            isLoading={batches.isLoading}
            isError={batches.isError}
            onRetry={() => batches.refetch()}
            getRowId={(x) => x.id}
            caption="Medicine batches"
            searchText={(x) => `${x.medicineName} ${x.batchNo} ${x.category}`}
            searchPlaceholder="Search medicine or batch"
            filters={[
              { id: "category", label: "Categories", options: categories.map((c) => ({ value: c, label: c })), match: (x, v) => x.category === v },
              {
                id: "state",
                label: "Expiry states",
                options: [
                  { value: "expired", label: "Expired" },
                  { value: "valid", label: "Valid" },
                ],
                match: (x, v) => (v === "expired" ? isExpired(x) : !isExpired(x)),
              },
            ]}
            columns={[
              { id: "med", header: "Medicine", sortValue: (x) => x.medicineName, cell: (x) => <div><p className="font-medium">{x.medicineName}</p><p className="text-xs text-muted-foreground">{x.category}</p></div> },
              { id: "batch", header: "Batch", cell: (x) => <span className="font-mono text-xs">{x.batchNo}</span> },
              { id: "mfg", header: "Mfg", hideBelow: "lg", sortValue: (x) => x.manufacturedOn, cell: (x) => formatDate(x.manufacturedOn) },
              { id: "exp", header: "Expiry", sortValue: (x) => x.expiresOn, cell: (x) => <div className="flex flex-col items-start gap-1"><span>{formatDate(x.expiresOn)}</span><ExpiryBadge batch={x} /></div> },
              { id: "qty", header: "Qty", sortValue: (x) => x.quantity, className: "text-right", cell: (x) => <span className="tabular-nums">{x.quantity}</span> },
              { id: "cost", header: "Unit cost", hideBelow: "md", className: "text-right", cell: (x) => <span className="tabular-nums">{formatCurrency(x.unitCost, true)}</span> },
              { id: "mrp", header: "MRP", hideBelow: "md", className: "text-right", cell: (x) => <span className="tabular-nums">{formatCurrency(x.mrp, true)}</span> },
            ]}
          />
        </TabsContent>
        <TabsContent value="summary">
          <DataTable
            data={summary}
            isLoading={batches.isLoading}
            getRowId={(m) => m.medicineId}
            caption="Stock summary"
            searchText={(m) => `${m.name} ${m.category}`}
            searchPlaceholder="Search medicine"
            columns={[
              { id: "name", header: "Medicine", sortValue: (m) => m.name, cell: (m) => <span className="font-medium">{m.name}</span> },
              { id: "cat", header: "Category", cell: (m) => m.category },
              { id: "qty", header: "Sellable stock", sortValue: (m) => m.quantity, className: "text-right", cell: (m) => <span className="tabular-nums">{m.quantity}</span> },
              { id: "reorder", header: "Reorder level", className: "text-right", cell: (m) => <span className="tabular-nums">{m.reorderLevel}</span> },
              { id: "state", header: "Status", sortValue: (m) => (m.low ? 0 : 1), cell: (m) => (m.low ? <Badge variant="warning">Reorder</Badge> : <Badge variant="success">OK</Badge>) },
            ]}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
