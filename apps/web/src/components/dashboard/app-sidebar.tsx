"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ROLE_HOME, ROLE_LABELS, type Role } from "@medcore/types";
import { Logo, LogoMark } from "@/components/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAVIGATION, SHARED_NAV, type NavItem, type NavSection } from "@/lib/navigation";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

function isActive(pathname: string, item: NavItem, role: Role) {
  // The role home only matches exactly; other items also match their sub-pages.
  if (item.href === ROLE_HOME[role]) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Navigation list, shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({
  role,
  collapsed = false,
  onNavigate,
}: {
  role: Role;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections: NavSection[] = [...NAVIGATION[role], SHARED_NAV];

  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-6">
      {sections.map((section, i) => (
        <div key={i} className="grid gap-1">
          {section.title && !collapsed && (
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {section.title}
            </p>
          )}
          {section.items.map((item) => {
            const active = isActive(pathname, item, role);
            const link = (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground transition-colors outline-none",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <item.icon className={cn("size-[1.1rem] shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-primary")} aria-hidden />
                {collapsed ? <span className="sr-only">{item.title}</span> : <span className="truncate">{item.title}</span>}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.title}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={item.href}>{link}</div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppSidebar({ role }: { role: Role }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-[4.25rem]" : "w-64",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
        {collapsed ? (
          <Link href={ROLE_HOME[role]} aria-label="MedCore home">
            <LogoMark />
          </Link>
        ) : (
          <Logo href={ROLE_HOME[role]} />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {!collapsed && (
          <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{ROLE_LABELS[role]}</span>
          </p>
        )}
        <SidebarNav role={role} collapsed={collapsed} />
      </div>

      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
