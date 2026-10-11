import type { ReactNode } from "react";
import { dismiss, publish, type ToastOptions } from "./toast-store.js";

export type { ToastAction, ToastOptions } from "./toast-store.js";

type ToastId = string | number;

function toast(message: ReactNode, options?: ToastOptions): ToastId {
  return publish(message, "default", options);
}

toast.success = (message: ReactNode, options?: ToastOptions): ToastId =>
  publish(message, "success", options);
toast.error = (message: ReactNode, options?: ToastOptions): ToastId =>
  publish(message, "error", options);
toast.dismiss = (id?: ToastId): void => dismiss(id);

export { toast };
