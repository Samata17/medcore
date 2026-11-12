"use client";

import * as React from "react";
import { Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";

const TooltipProvider = T.Provider;
const Tooltip = T.Root;
const TooltipTrigger = T.Trigger;

function TooltipContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof T.Content>) {
  return (
    <T.Portal>
      <T.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background shadow-md animate-in fade-in-0 zoom-in-95",
          className,
        )}
        {...props}
      />
    </T.Portal>
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
