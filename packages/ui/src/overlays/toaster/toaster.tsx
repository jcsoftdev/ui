"use client";

import type { ComponentProps } from "react";
import { Toaster as SonnerToaster } from "sonner";

export { toast } from "sonner";

export interface ToasterProps extends ComponentProps<typeof SonnerToaster> {}

/**
 * Ephemeral, non-critical confirmations. Pass `action: { label, onClick }` to
 * `toast()` for an undo button. Critical messages belong in a banner instead.
 */
export function Toaster({
  position = "bottom-center",
  duration = 6000,
  visibleToasts = 2,
  ...props
}: ToasterProps) {
  return (
    <SonnerToaster
      position={position}
      duration={duration}
      visibleToasts={visibleToasts}
      toastOptions={{
        classNames: {
          toast:
            "rounded-button! border-none! bg-toast-bg! text-toast-ink! shadow-overlay! text-control! min-h-11! py-1.5! pr-2! pl-4!",
          actionButton: "rounded-button! bg-toast-ink/18! text-toast-ink! font-bold! h-8! px-3!",
        },
      }}
      {...props}
    />
  );
}
