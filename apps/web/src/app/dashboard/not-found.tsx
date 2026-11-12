import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-accent text-primary">
        <Compass className="size-6" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">This dashboard page doesn&apos;t exist.</p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Back to my dashboard</Link>
      </Button>
    </div>
  );
}
