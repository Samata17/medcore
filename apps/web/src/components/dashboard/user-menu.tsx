"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { ROLE_LABELS, type AuthUser } from "@medcore/types";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { useLogout } from "@/hooks/use-session";

export function UserMenu({ user }: { user: AuthUser }) {
  const logout = useLogout();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const name = `${user.role === "DOCTOR" ? "Dr. " : ""}${user.firstName} ${user.lastName}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 pr-2 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Avatar name={name} className="size-8" />
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-medium">{name}</span>
            <span className="block text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</span>
          </span>
          <ChevronDown className="hidden size-4 text-muted-foreground md:block" aria-hidden />
          <span className="sr-only">Open account menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <span className="block truncate">{name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profile">
              <UserRound /> Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <LogOut /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Log out of MedCore?"
        description="You'll need to sign in again to access your workspace."
        confirmLabel="Log out"
        onConfirm={logout}
      />
    </>
  );
}
