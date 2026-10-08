"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export interface TabsProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.Root> {}

/**
 * To sync the active tab with a search param, use Radix's controlled pattern:
 * `value={param}` + `onValueChange={(v) => updateParam(v)}`.
 */
export function Tabs({ className, ...props }: TabsProps) {
  return <TabsPrimitive.Root className={cn("flex min-w-0 flex-col", className)} {...props} />;
}

export interface TabsListProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.List> {}

export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn(
        "@container/tabs flex max-w-full gap-0.5 overflow-x-auto overscroll-x-contain border-b-divider px-2",
        className,
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  /** Optional record count shown after the label. */
  count?: number;
}

export function TabsTrigger({ className, count, children, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-2.5 @max-[420px]/tabs:px-2 pt-2.75 pb-2.5 text-control text-ink-3 hover:text-ink focus-visible:-outline-offset-2 data-[state=active]:border-accent-word data-[state=active]:text-ink",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && <span className="text-count text-ink-3">{count}</span>}
    </TabsPrimitive.Trigger>
  );
}

export interface TabsContentProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.Content> {}

export function TabsContent({ className, ...props }: TabsContentProps) {
  return <TabsPrimitive.Content className={cn(className)} {...props} />;
}
