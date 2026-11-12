import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccessDenied({ home }: { home: string }) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-destructive-soft text-destructive">
          <ShieldAlert className="size-7" aria-hidden />
        </span>
        <h1 className="mt-6 text-2xl font-bold">You don&apos;t have access to this page</h1>
        <p className="mt-2 text-muted-foreground">
          This area belongs to a different role. If you think this is a mistake, contact your hospital administrator.
        </p>
        <Button asChild className="mt-8">
          <Link href={home}>Go to my dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
