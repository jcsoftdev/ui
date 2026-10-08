import { CircleAlert, FileText, X } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";
import { IconAction } from "../internal/icon-action.js";

export type AttachmentStatus = "done" | "uploading" | "error";
export type AttachmentVariant = "chip" | "preview";

export interface AttachmentProps extends Omit<ComponentPropsWithoutRef<"fieldset">, "children"> {
  name: string;
  /** Pre-formatted size, e.g. `240 KB`. */
  size?: string;
  /** Image URL (or object URL). Without it a document icon is shown. */
  previewSrc?: string;
  status?: AttachmentStatus;
  /** 0-100, only for `uploading`. */
  progress?: number;
  /** `chip` is one compact line; `preview` is a tile with a larger thumbnail. */
  variant?: AttachmentVariant;
  /** Shows the remove button. */
  onRemove?: () => void;
}

/** File chip or preview tile for prompt attachments, with an optional remove button. */
export function Attachment({
  name,
  size,
  previewSrc,
  status = "done",
  progress,
  variant = "chip",
  onRemove,
  className,
  ...props
}: AttachmentProps) {
  const preview = variant === "preview";
  const thumb = previewSrc ? (
    <img src={previewSrc} alt="" className="size-full object-cover" />
  ) : status === "error" ? (
    <CircleAlert aria-hidden className="size-4 text-danger" />
  ) : (
    <FileText aria-hidden className="size-4 text-ink-3" />
  );
  const detail =
    status === "uploading"
      ? `Subiendo${progress != null ? ` ${Math.round(progress)}%` : "…"}`
      : status === "error"
        ? "Error al subir"
        : size;

  return (
    <fieldset
      aria-label={`Adjunto ${name}`}
      className={cn(
        "relative flex min-w-0 max-w-full items-center gap-density-sm bg-surface-control text-ink border-control shadow-control",
        preview
          ? "w-40 flex-col items-stretch rounded-card p-1.5"
          : "h-control-sm rounded-button pl-1.5 pr-1",
        status === "error" && "text-danger",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-badge bg-surface-sunken",
          preview ? "h-20 w-full" : "size-6",
        )}
      >
        {thumb}
      </span>
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate text-meta font-medium">{name}</span>
        {detail && (preview || status !== "done") ? (
          <span
            className={cn("truncate text-meta", status === "error" ? "text-danger" : "text-ink-3")}
          >
            {detail}
          </span>
        ) : null}
      </span>
      {status === "uploading" && progress != null ? (
        <span
          role="progressbar"
          aria-label={`Progreso de ${name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="absolute inset-x-1.5 bottom-0.5 h-0.5 overflow-hidden rounded-badge bg-track"
        >
          <span
            className="block h-full bg-accent"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </span>
      ) : null}
      {onRemove ? (
        <IconAction
          label={`Quitar ${name}`}
          onClick={onRemove}
          className={cn(
            "size-5",
            preview && "absolute right-2.5 top-2.5 bg-surface-overlay shadow-control",
          )}
        >
          <X aria-hidden />
        </IconAction>
      ) : null}
    </fieldset>
  );
}
