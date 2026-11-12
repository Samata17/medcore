"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Search } from "lucide-react";
import type { AuthUser } from "@medcore/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "@/components/dashboard/app-sidebar";
import { NotificationCenter } from "@/components/dashboard/notification-center";
import { UserMenu } from "@/components/dashboard/user-menu";
import { PATIENT_SEARCH_HREF } from "@/lib/navigation";
import { ROLE_HOME } from "@medcore/types";

export function Topbar({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState("");
  const searchHref = PATIENT_SEARCH_HREF[user.role];

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchHref) return;
    router.push(`${searchHref}?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Dashboard sections</SheetDescription>
          <Logo href={ROLE_HOME[user.role]} className="mb-4" />
          <div className="overflow-y-auto">
            <SidebarNav role={user.role} onNavigate={() => setMenuOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {searchHref ? (
        <form role="search" onSubmit={onSearch} className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="global-search" className="sr-only">
            Search patients
          </label>
          <Input
            id="global-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patients by name, MRN or phone…"
            className="h-9 bg-muted/60 pl-9"
          />
        </form>
      ) : (
        <div className="flex-1" />
      )}

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <NotificationCenter />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
