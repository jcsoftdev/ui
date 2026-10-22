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
toast.info = (message: ReactNode, options?: ToastOptions): ToastId =>
  publish(message, "info", options);
toast.warning = (message: ReactNode, options?: ToastOptions): ToastId =>
  publish(message, "warning", options);
/** Same toast as `toast.error`, under the status-tone name the other components use. */
toast.danger = toast.error;
toast.dismiss = (id?: ToastId): void => dismiss(id);

export { toast };
