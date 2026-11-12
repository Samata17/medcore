"use client";

import * as React from "react";
import { AlertDialog as AD } from "radix-ui";
import { cn } from "@/lib/utils";
import { overlay, panel } from "@/components/ui/dialog";

const AlertDialog = AD.Root;
const AlertDialogTrigger = AD.Trigger;
const AlertDialogAction = AD.Action;
const AlertDialogCancel = AD.Cancel;

function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AD.Content>) {
  return (
    <AD.Portal>
      <AD.Overlay className={overlay} />
      <AD.Content className={cn(panel, "max-w-md", className)} {...props} />
    </AD.Portal>
  );
}
function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AD.Title>) {
  return <AD.Title className={cn("font-display text-lg font-semibold", className)} {...props} />;
}
function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AD.Description>) {
  return <AD.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
